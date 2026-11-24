"""Single-workspace First Chair API and production static-file host."""
import contextlib
import fcntl
import hmac
import json
import os
import shutil
import sqlite3
import subprocess
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from . import graph, providers

ROOT=Path(__file__).resolve().parents[1]
app=FastAPI(title="First Chair",version="1.0.0")
mutex=threading.RLock()
LIVE=os.getenv("FIRSTCHAIR_MODE","rehearsal").casefold()=="live"
if LIVE and not providers.env("FIRSTCHAIR_OPERATOR_TOKEN"):
    raise RuntimeError("Live mode requires FIRSTCHAIR_OPERATOR_TOKEN.")
DB=Path(os.environ.get("FIRSTCHAIR_DB",ROOT/".local"/("live.sqlite" if LIVE else "demo.sqlite")))
NODE=providers.env("FIRSTCHAIR_NODE") or shutil.which("node") or os.environ.get("CODEX_TASK_WORKSPACE_NODE")
if not NODE: raise RuntimeError("Node.js 22 or later must be on PATH, or set FIRSTCHAIR_NODE.")
EVENTS={"enrich":("lead_enriched",2),"graph":("graph_query",1),"case":("business_case_generated",1),"send":("outreach_sent",1)}
ALLOWED={"product","profile","discover","graph","enrich","case","draft","edit","approve","reject","send","stage","label","reset"}


def now():
    return datetime.now(timezone.utc).isoformat()


def js(method, state=None, action=None, context=None):
    try:
        reply=subprocess.run([NODE,str(ROOT/"scripts/transition.mjs")],input=json.dumps({"method":method,"state":state,"action":action,"context":context or {}}),capture_output=True,text=True,timeout=12,check=True)
        result=json.loads(reply.stdout)
    except (subprocess.SubprocessError,ValueError,OSError):
        raise HTTPException(500,"The calculation service is unavailable.") from None
    if not result.get("ok"): raise HTTPException(422,result.get("error","Invalid operation."))
    return result["result"]


@contextlib.contextmanager
def db_session():
    DB.parent.mkdir(parents=True,exist_ok=True)
    # This is a single-operator MVP. The lock also covers durable reservations between transactions.
    with mutex, open(str(DB)+".lock","a") as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        conn=sqlite3.connect(DB,timeout=30)
        conn.row_factory=sqlite3.Row
        try:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY, data TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS commands (id TEXT PRIMARY KEY, signature TEXT, revision INTEGER);
                CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, data TEXT NOT NULL, delivered INTEGER DEFAULT 0);
                CREATE TABLE IF NOT EXISTS dispatch (fingerprint TEXT PRIMARY KEY, state TEXT, provider_id TEXT);
                CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, data TEXT NOT NULL);
            """)
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def workspace(db):
    row=db.execute("SELECT data FROM workspace WHERE id=1").fetchone()
    if row: return json.loads(row["data"])
    s=js("initial",context={"live":LIVE})
    if LIVE:
        s.update(mode="live",demoInbox=providers.env("FIRSTCHAIR_TEST_INBOX"),credits=int(os.getenv("FIRSTCHAIR_CAMPAIGN_CREDITS","10")))
        s["icp"]["approved"]=False
    save(db,s)
    return s


def save(db,state):
    db.execute("INSERT INTO workspace VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",(json.dumps(state),))


def authorized(x_workspace_token:str=Header(default="")):
    token=providers.env("FIRSTCHAIR_OPERATOR_TOKEN")
    if token and not hmac.compare_digest(token,x_workspace_token): raise HTTPException(401,"Connect with the operator token.")


def worker_auth(x_band_worker:str=Header(default="")):
    token=providers.env("FIRSTCHAIR_BAND_WORKER_TOKEN")
    if not LIVE or not token or not hmac.compare_digest(token,x_band_worker): raise HTTPException(403,"Worker access required.")


class Action(BaseModel):
    kind:str=Field(max_length=24)
    id:str|None=Field(default=None,max_length=160)
    payload:dict[str,Any]=Field(default_factory=dict)
    operation_id:uuid.UUID
    revision:int=Field(ge=0)


class Turn(BaseModel):
    job:uuid.UUID
    role:str=Field(max_length=12)
    turn:int=Field(ge=0,le=9)


def action_data(item):
    return {"kind":item.kind,"id":item.id,"payload":item.payload}


def action_sig(action):
    return json.dumps(action,sort_keys=True,separators=(",",":"))


def persist_command(db,key,action,state):
    save(db,state)
    db.execute("INSERT INTO commands VALUES(?,?,?)",(key,action_sig(action),state["revision"]))


def flush_events(db):
    for row in db.execute("SELECT * FROM events WHERE delivered=0 ORDER BY rowid LIMIT 50").fetchall():
        try: providers.meter(json.loads(row["data"]))
        except providers.ProviderError: break
        db.execute("UPDATE events SET delivered=1 WHERE id=?",(row["id"],))


def read_job(db,key):
    row=db.execute("SELECT data FROM jobs WHERE id=?",(key,)).fetchone()
    return json.loads(row["data"]) if row else None


def write_job(db,key,job):
    db.execute("INSERT INTO jobs VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",(key,json.dumps(job)))


def band_start(db,s,action,key):
    providers.require("band","tavily")
    if not providers.env("FIRSTCHAIR_BAND_WORKER_TOKEN"): raise providers.ProviderError("Configure the Band worker token.")
    packet=js("packet",s,action)
    job={"status":"running","revision":s["revision"],"action":action,"packet":packet,"next":"PLANNER","turn":0,"history":[],"replies":{}}
    write_job(db,key,job);db.commit()
    try:
        room=quote(providers.env("BAND_ROOM_ID"),safe="")
        providers.request("POST","https://app.band.ai/api/v1/agent/chats/"+room+"/messages",
            headers={"X-API-Key":providers.env("BAND_REVIEWER_API_KEY")},
            json={"message":{"content":f"FirstChair job {key} turn 0. Prepare a sourced account brief.","mentions":[{"id":providers.env("BAND_PLANNER_AGENT_ID")}]}})
    except providers.ProviderError:
        job.update(status="failed",error="Band did not acknowledge the handoff. Check room membership and the five worker identities.")
        write_job(db,key,job);db.commit();raise
    return JSONResponse(status_code=202,content={"job":key,"status":"running"})


@app.get("/api/status")
def status():
    return {"service":"first-chair","mode":"live" if LIVE else "rehearsal","requiresToken":bool(providers.env("FIRSTCHAIR_OPERATOR_TOKEN")),"configured":providers.configured()}


@app.get("/api/workspace",dependencies=[Depends(authorized)])
def get_workspace():
    with db_session() as db: return workspace(db)


@app.get("/api/jobs/{job_id}",dependencies=[Depends(authorized)])
def get_job(job_id:uuid.UUID):
    with db_session() as db:
        job=read_job(db,str(job_id))
        if not job: raise HTTPException(404,"Unknown job.")
        return {"status":job["status"],"role":job["next"],"error":job.get("error"),"workspace":workspace(db) if job["status"]=="complete" else None}


@app.post("/api/band/turn",dependencies=[Depends(worker_auth)])
def band_turn(item:Turn):
    with db_session() as db:
        key=str(item.job);job=read_job(db,key)
        if not job: raise HTTPException(404,"Unknown Band job.")
        idx=str(item.turn)
        if idx in job["replies"] and job["replies"][idx]["role"]==item.role: return job["replies"][idx]["output"]
        if job["status"]!="running" or item.role!=job["next"] or item.turn!=job["turn"]: raise HTTPException(409,"Unexpected Band turn.")
        try:
            packet=job["packet"]
            if item.role=="RESEARCHER":
                docs=providers.extract([s["url"] for s in packet["account"]["sources"]])
                for source in packet["account"]["sources"]:
                    if providers.normal(source["quote"]) not in providers.normal(docs.get(source["url"],"")):
                        raise providers.ProviderError("A cited excerpt no longer matches its source. Run discovery again.")
            output=js("role",action={"role":item.role},context={"packet":packet,"prior":job.get("prior",{})})
            job["replies"][idx]={"role":item.role,"output":output}
            job["history"].append({"actor":item.role.title(),"title":item.role.title()+" handoff","details":output["summary"],"account":job["action"]["id"],"at":now()})
            job.update(next=output["next"],turn=item.turn+1,prior=output)
            if output["next"]=="HUMAN":
                s=workspace(db)
                if s["revision"]!=job["revision"]: raise HTTPException(409,"Workspace changed during the agent run. Prepare a fresh draft.")
                updated=js("apply",s,job["action"],{"reviewedCopy":output,"job":key})
                updated["activity"]=list(reversed(job["history"]))+updated["activity"]
                persist_command(db,key,job["action"],updated);job["status"]="complete"
            write_job(db,key,job)
            return {k:output[k] for k in ("next","summary","sourceIds") if k in output}
        except (HTTPException,providers.ProviderError) as exc:
            job.update(status="failed",error=exc.detail if isinstance(exc,HTTPException) else str(exc))
            write_job(db,key,job);db.commit()
            raise HTTPException(422,job["error"]) from None


@app.post("/api/meter/retry",dependencies=[Depends(authorized)])
def retry_meter():
    with db_session() as db:
        if LIVE: flush_events(db)
        return {"pending":db.execute("SELECT COUNT(*) FROM events WHERE delivered=0").fetchone()[0]}


@app.post("/api/actions",dependencies=[Depends(authorized)])
def perform(item:Action):
    a=action_data(item);key=str(item.operation_id)
    if item.kind not in ALLOWED or len(action_sig(a))>25000: raise HTTPException(422,"Invalid operation or payload.")
    try:
        with db_session() as db:
            s=workspace(db)
            old=db.execute("SELECT signature FROM commands WHERE id=?",(key,)).fetchone()
            if old:
                if old["signature"]!=action_sig(a): raise HTTPException(409,"This operation ID belongs to another request.")
                return s
            existing=read_job(db,key)
            if existing:
                if action_sig(existing["action"])!=action_sig(a): raise HTTPException(409,"This operation ID belongs to another request.")
                if existing["status"]=="failed": raise HTTPException(422,existing["error"])
                return JSONResponse(status_code=202,content={"job":key,"status":existing["status"]})
            if s["revision"]!=item.revision: raise HTTPException(409,"Another action changed the workspace. Review and retry.")
            context={"job":key,"now":now()}
            bill=EVENTS.get(item.kind) if item.kind!="case" or item.payload.get("approve") else None
            # Validate local inputs, scope, funds and approval before touching a provider.
            preview=js("apply",s,a,context)
            if not LIVE:
                persist_command(db,key,a,preview)
                return preview
            if bill:
                avail=providers.gate(*bill);s["credits"]=min(s["credits"],avail)
            if item.kind=="product": context["icp"]=providers.infer(item.payload,js("profile",action=a))
            if item.kind=="discover":
                context.update(liveDiscovery=True,prospects=providers.discover(s))
            acct=next((x for x in s["accounts"] if x["id"]==item.id),None)
            if item.kind=="graph": context["graphMatches"]=graph.query(s,acct,item.payload["name"])
            if item.kind=="enrich": context["contact"]=providers.enrich(acct)
            if item.kind=="draft": return band_start(db,s,a,key)
            if item.kind=="send":
                providers.require("gmail")
                msg=s["messages"][item.id];fingerprint=msg["approval"]["hash"]
                prior=db.execute("SELECT state FROM dispatch WHERE fingerprint=?",(fingerprint,)).fetchone()
                if prior: raise HTTPException(409,"A delivery already exists or needs reconciliation in the team inbox.")
                db.execute("INSERT INTO dispatch VALUES(?,'reserved',NULL)",(fingerprint,));db.commit()
                provider_id=providers.send_test(msg,key)
                db.execute("UPDATE dispatch SET state='accepted', provider_id=? WHERE fingerprint=?",(provider_id,fingerprint))
                context["gmail"]=True
            updated=js("apply",s,a,context)
            persist_command(db,key,a,updated)
            if bill: db.execute("INSERT INTO events VALUES(?,?,0)",(key,json.dumps(updated["usage"][0])))
            db.commit()
            if bill: flush_events(db)
            return updated
    except providers.ProviderError as exc:
        raise HTTPException(424,str(exc)) from None


if (ROOT/"out").is_dir():
    app.mount("/",StaticFiles(directory=ROOT/"out",html=True),name="desk")
