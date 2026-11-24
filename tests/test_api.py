import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4
from fastapi.testclient import TestClient
from backend import app as api, providers


class WorkspaceApiTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.patch=patch.object(api,"DB",Path(self.tmp.name)/"state.db")
        self.patch.start();self.addCleanup(self.patch.stop)
        self.client=TestClient(api.app)

    def send(self,kind,revision,id="exa",payload=None,key=None):
        return self.client.post("/api/actions",json={"kind":kind,"id":id,"payload":payload or {},"revision":revision,"operation_id":str(key or uuid4())})

    def test_retries_and_stale_writes(self):
        key=uuid4();initial=self.client.get("/api/workspace").json();self.assertEqual(initial["credits"],10)
        first=self.send("case",0,payload={"approve":True},key=key);self.assertEqual(first.status_code,200)
        retry=self.send("case",0,payload={"approve":True},key=key);self.assertEqual(retry.json()["credits"],9)
        self.assertEqual(self.send("case",0,payload={"approve":False},key=key).status_code,409)
        self.assertEqual(self.send("enrich",0).status_code,409)
        self.assertEqual(self.client.get("/api/workspace").json()["revision"],1)

    def test_four_metered_actions_and_zero_credit_block(self):
        seq=[("graph",{"name":"warm"}),("enrich",{}),("case",{"approve":True}),("draft",{}),("approve",{}),("send",{})]
        for i,(kind,payload) in enumerate(seq):
            resp=self.send(kind,i,payload=payload);self.assertEqual(resp.status_code,200,resp.text)
        state=resp.json();self.assertEqual(state["credits"],5);self.assertEqual(len(set(e["kind"] for e in state["usage"])),4)
        self.assertEqual(state["outbox"][0]["method"],"Local test outbox")
        for i in range(5): self.assertEqual(self.send("graph",6+i,payload={"name":"warm"}).status_code,200)
        self.assertEqual(self.send("enrich",11).status_code,422)
        self.assertEqual(self.client.get("/api/workspace").json()["credits"],0)

    def test_secret_boundaries(self):
        with patch.dict("os.environ",{"FIRSTCHAIR_OPERATOR_TOKEN":"test-only"}):
            self.assertEqual(self.client.get("/api/workspace").status_code,401)
            self.assertEqual(self.client.get("/api/workspace",headers={"X-Workspace-Token":"test-only"}).status_code,200)
            self.assertNotIn("test-only",self.client.get("/api/status").text)

    def test_flexprice_contract_and_fail_closed(self):
        with patch.object(providers,"require"),patch.object(providers,"flex",side_effect=[{"features":[{"feature":{"lookup_key":"graph_query"},"entitlement":{"is_enabled":True}}]},{"wallet_status":"active","real_time_credit_balance":"3.75"}]) as fake:
            self.assertEqual(providers.gate("graph_query",1),3);self.assertEqual(fake.call_count,2)
        with patch.object(providers,"require"),patch.object(providers,"flex",return_value={"features":[]}):
            with self.assertRaises(providers.ProviderError): providers.gate("graph_query",1)
        with patch.object(providers,"flex",return_value={}) as send:
            providers.meter({"id":"stable","kind":"graph_query","at":"2026-11-24T19:00:00Z","agent":"Researcher","account":"exa","cost":1})
            body=send.call_args.kwargs["json"];self.assertEqual(body["event_id"],"stable");self.assertEqual(body["properties"]["credits"],"1")

    def test_live_mode_falls_back_per_service(self):
        off={k:False for k in providers.CONFIG}
        with patch.object(api,"LIVE",True),patch.object(providers,"configured",return_value=off):
            s=self.client.get("/api/workspace").json();self.assertEqual(s["mode"],"live");self.assertEqual(s["accounts"],[])
            seq=[("profile",None,{"approved":True,"fields":s["icp"]["fields"]}),("discover",None,{}),("enrich","exa",{}),("graph","exa",{"name":"warm"}),
                 ("case","exa",{"approve":True}),("draft","exa",{}),("approve","exa",{}),("send","exa",{})]
            for i,(kind,id,payload) in enumerate(seq):
                r=self.send(kind,i,id=id,payload=payload);self.assertEqual(r.status_code,200,kind+": "+r.text)
            s=r.json();self.assertEqual(s["outbox"][0]["method"],"Local test outbox");self.assertEqual(next(a for a in s["accounts"] if a["id"]=="exa")["stage"],"Contacted")
            self.assertEqual(self.client.post("/api/meter/retry").json()["pending"],0)

    def test_title_normalization(self):
        for title in ("VP Engineering","Head of Eng","CTO"): self.assertEqual(providers.role_bucket(title),"eng_leader")
        self.assertEqual(providers.role_bucket("Co-founder"),"founder");self.assertEqual(providers.role_bucket("Designer"),"other")

    def test_writer_agent_shapes_claude_draft(self):
        packet={"product":{"name":"Flexprice"},"financial":{"net":66500,"cashNet":-10000},
                "account":{"name":"Exa","persona":"Eng lead","sources":[{"id":"exa-websets","quote":"Usage now draws down","kind":"price_change","verified":True}]}}
        fake={"subject":"Credits at Exa","body":"Hi","claims":[{"text":"t","source":"exa-websets","quote":"Usage now draws down"}]}
        with patch.object(providers,"json_model",return_value=fake) as model:
            out=providers.write_draft(packet,{"revision":True,"revisions":1,"feedback":"Fix $90,000","subject":"a","body":"b"})
        self.assertEqual(out["next"],"REVIEWER");self.assertEqual(out["sourceIds"],["exa-websets"]);self.assertEqual(out["revisions"],1)
        sent=model.call_args.args[1];self.assertEqual(sent["figures"]["cashNet"],"-$10,000");self.assertEqual(sent["reviewer_feedback"],"Fix $90,000")
        with patch.object(providers,"json_model",return_value={"subject":"","body":""}):
            with self.assertRaises(providers.ProviderError): providers.write_draft(packet,{})


if __name__=="__main__": unittest.main()
