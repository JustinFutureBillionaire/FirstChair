"""Rebuild a scoped, evidence-backed subgraph before each live relationship query."""
from .providers import ProviderError, env, require

HISTORY = [("modal","Erik Bernhardsson","Spotify"),("modal","Erik Bernhardsson","Better")]
WARM = """
MATCH (seller:FCProduct {key:$workspace})-[:HAS_REFERENCE]->(former:FCCompany)
MATCH (person:FCPerson)-[:PREVIOUSLY_WORKED_AT]->(former)
MATCH (person)-[:WORKS_AT]->(a:FCCompany {key:$company})-[:HAS_SIGNAL]->(:FCSignal)-[:SUPPORTED_BY]->(:FCSource)
RETURN DISTINCT person.name AS person, former.name AS former LIMIT 1
"""
DISPLACE = """
MATCH (a:FCCompany {key:$company})-[:USES]->(v:FCVendor)
MATCH (a)-[:HAS_SIGNAL]->(s:FCSignal)-[:SUPPORTED_BY]->(src:FCSource)
WHERE s.kind='dissatisfaction' AND s.vendor=v.name AND s.day IS NOT NULL
  AND date(s.day) <= date($day) AND date(s.day) >= date($day)-duration('P90D')
RETURN DISTINCT v.name AS vendor, src.url AS url LIMIT 1
"""


def query(state, account, name):
    require("neo4j")
    from neo4j import GraphDatabase
    workspace="firstchair/"+(env("FLEXPRICE_EXTERNAL_CUSTOMER_ID") or "operator")
    company=workspace+"/"+account["id"]
    def work(tx):
        params={"workspace":workspace,"company":company,"companyName":account["name"],"product":state["product"]["name"]}
        tx.run("MERGE (p:FCProduct {key:$workspace}) SET p.name=$product MERGE (a:FCCompany {key:$company}) SET a.name=$companyName MERGE (a)-[:MATCHED_TO]->(p)",**params).consume()
        tx.run("MATCH (:FCProduct {key:$workspace})-[r:HAS_REFERENCE]->() DELETE r",workspace=workspace).consume()
        for former in [x.strip() for x in state["product"]["customers"].replace(";",",").replace("\n",",").split(",") if x.strip()]:
            tag=former.casefold().removesuffix(".com")
            tx.run("MATCH (p:FCProduct {key:$w}) MERGE (c:FCCompany {key:$k}) SET c.name=$n MERGE (p)-[:HAS_REFERENCE]->(c)",w=workspace,k=workspace+"/ref/"+tag,n=former).consume()
        for acct,person,former in HISTORY:
            if account["id"]!=acct and account["domain"]!="modal.com": continue
            tx.run("MATCH (a:FCCompany {key:$a}) MERGE (p:FCPerson {key:$p}) SET p.name=$pn MERGE (c:FCCompany {key:$c}) SET c.name=$cn MERGE (p)-[:WORKS_AT]->(a) MERGE (p)-[r:PREVIOUSLY_WORKED_AT]->(c) SET r.url=$url",a=company,p=workspace+"/"+person,pn=person,c=workspace+"/ref/"+former.casefold(),cn=former,url="https://erikbern.com/about.html").consume()
        tx.run("MATCH (:FCCompany {key:$c})-[r:HAS_SIGNAL|USES]->() DELETE r",c=company).consume()
        for s in account["sources"]:
            if not s["verified"]: continue
            tx.run("MATCH (a:FCCompany {key:$c}) MERGE (s:FCSignal {key:$k}) SET s.kind=$kind,s.day=$day,s.vendor=$vendor MERGE (u:FCSource {url:$url}) MERGE (a)-[:HAS_SIGNAL]->(s) MERGE (s)-[:SUPPORTED_BY]->(u)",c=company,k=company+"/"+s["id"],kind=s["kind"],day=s.get("published"),vendor=s.get("incumbent"),url=s["url"]).consume()
        if account.get("incumbent"):
            v=account["incumbent"]
            tx.run("MATCH (a:FCCompany {key:$c}) MERGE (v:FCVendor {name:$n}) MERGE (a)-[r:USES]->(v) SET r.url=$url",c=company,n=v["name"],url=v["url"]).consume()
        return tx.run(WARM if name=="warm" else DISPLACE,workspace=workspace,company=company,day=state["asOf"]).single()
    try:
        with GraphDatabase.driver(env("NEO4J_URI"),auth=(env("NEO4J_USERNAME"),env("NEO4J_PASSWORD")),connection_timeout=6,max_transaction_retry_time=5) as driver:
            with driver.session(database=env("NEO4J_DATABASE") or "neo4j") as session:
                hit=session.execute_write(work)
        if not hit: return []
        reason=(f"{hit['person']} previously worked at your confirmed reference {hit['former']}." if name=="warm" else f"Recent public evidence describes friction with {hit['vendor']}: {hit['url']}")
        return [{"id":account["id"],"reason":reason}]
    except Exception:
        raise ProviderError("Neo4j could not complete the relationship query.") from None
