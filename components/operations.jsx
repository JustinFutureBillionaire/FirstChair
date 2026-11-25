"use client";
import {useState} from "react";
import {Check,Copy,Lock,LockOpen,Send,X} from "lucide-react";
import {activityLabels,allocation,conversion,inputsFor,precision,rates,stageNames,evaluationPool} from "../lib/workspace.mjs";
import {businessCase,dollars} from "../lib/finance.mjs";
import {roles,runRole} from "../lib/handoffs.mjs";
import {Chip,Company,DateText,Empty,Modal,Tabs} from "./ui";
import {Benchmark,CreditBlockTest,benchmarkResult} from "./demo";

const roleName={PLANNER:"Planner",RESEARCHER:"Researcher",ANALYST:"Analyst",WRITER:"Writer",REVIEWER:"Reviewer",HUMAN:"You"};

// The agent handoff for this draft. Offline it replays the same role code the Band workers run.
function handoff(s,a,m){
 if(s.mode==="live"){
  const names=roles.map(r=>roleName[r]);
  return s.activity.filter(x=>x.account===a.id&&names.includes(x.actor)&&/handoff$/.test(x.title)).slice(0,9).reverse().map(x=>({who:x.actor,text:x.details||x.title,bad:/reject/i.test(x.details+x.title)}));
 }
 const packet={account:a,approved:!!s.reviewedCases[a.id],product:s.product,budget:s.credits,financial:businessCase(inputsFor(s,a.id)),body:m};
 const out=[];let role="PLANNER",prior={};
 try{while(role!=="HUMAN"&&out.length<9){const r=runRole(role,packet,prior);out.push({who:roleName[role],text:r.summary,bad:role==="REVIEWER"&&r.next==="WRITER"});prior=r;role=r.next;}}catch(e){out.push({who:"Reviewer",text:e.message,bad:true});}
 return out;
}

// Marks which parts of the email came from a verified source and which from the approved math.
function tailored(body,sources,approved){
 const esc=x=>x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
 const titles=sources.map(x=>x.title).filter(Boolean);
 const re=new RegExp("(“(?:"+(titles.map(esc).join("|")||"(?!)")+")”|\\$\\d[\\d,]*)","g");
 return body.split(re).map((part,i)=>{
  if(i%2===0)return part;
  if(part.startsWith("$"))return approved.has(part.replace(/[,.]+$/,""))?<u key={i} title="From the approved business case">{part}</u>:part;
  const src=sources.find(x=>part.includes(x.title));
  return <mark key={i} title={src?"Verified: "+src.quote:""}>{part}</mark>;
 });
}

function Letter({s,a,m,act,busy,notify,go,animate}){
 const [edit,setEdit]=useState(false),[form,setForm]=useState({recipient:m.recipient,subject:m.subject,body:m.body});
 const sent=m.status==="Dispatched",email=m.channel==="Email",steps=handoff(s,a,m);
 const srcs=a.sources.filter(x=>m.sourceIds.includes(x.id));
 const fin=businessCase(inputsFor(s,a.id)),approved=new Set(["net","build","buy","cashNet"].map(k=>fin[k]).filter(Number.isFinite).map(v=>dollars(Math.abs(v))));
 return <div className={"compose"+(animate?" animate":"")}>
  <ol className="handoff" aria-label="Agent handoff">{[...steps,{who:"You",text:sent?"Approved and sent.":m.status==="Approved"?"Approved. Ready to send.":"Read it, edit if needed, approve the exact text."}].map((x,i)=><li key={i} className={(x.bad?"bad":"")+(x.who==="You"?" you":"")} style={{"--d":i*420+"ms"}}><b>{x.who}</b><span>{x.text}</span></li>)}</ol>
  <article className={"letter "+(m.status==="Approved"?"locked":"")+(sent?" sent":"")} style={{"--d":(steps.length+1)*420+"ms"}}>
   <div className="letter-top"><span className="state">{sent?<><Send size={14}/>Sent</>:m.status==="Approved"?<><Lock size={14}/>Approved, locked to this exact text</>:<><LockOpen size={14}/>{m.status==="Rejected"?"Rejected":"Waiting for your approval"}</>}</span><span>{m.channel}, {m.variant==="Direct"?"cold email based on a signal":m.variant.toLowerCase()}</span></div>
   {edit?<form className="stack" onSubmit={async e=>{e.preventDefault();if(await act("edit",a.id,form,"Saved. Approve the new text to send it."))setEdit(false);}}>
    <label className="field">To<input required value={form.recipient} onChange={e=>setForm({...form,recipient:e.target.value})}/></label>
    <label className="field">Subject<input required value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}/></label>
    <label className="field">Message<textarea rows="9" required value={form.body} onChange={e=>setForm({...form,body:e.target.value})}/></label>
    <div className="row"><button className="btn primary" disabled={busy}>Save</button><button type="button" className="btn" onClick={()=>setEdit(false)}>Cancel</button></div></form>:<>
   <dl className="envelope"><div><dt>To</dt><dd>{m.recipient}</dd></div><div><dt>Subject</dt><dd>{m.subject}</dd></div></dl>
   <p className="body">{tailored(m.body,srcs,approved)}</p>
   <p className="legend"><mark>Highlighted</mark> comes from a verified source. <u>Underlined</u> comes from the approved numbers.</p></>}
   {m.approval&&!edit&&<p className="fingerprint">Fingerprint {m.approval.hash.slice(0,16)}. Changing one character clears it.</p>}
   {!sent&&!edit&&<div className="row">
    {email&&m.status!=="Approved"&&<button className="btn primary" disabled={busy} onClick={()=>act("approve",a.id,{},"Approved. This exact text can now be sent.")}>Approve this exact text</button>}
    {email&&m.status==="Approved"&&<button className="btn primary" disabled={busy} onClick={()=>act("send",a.id,{},s.mode==="live"?"Sent to your team inbox.":"Sent to the demo outbox.")}><Send size={14}/>Send to {m.recipient} (1 credit)</button>}
    <button className="btn" onClick={()=>{setForm({recipient:m.recipient,subject:m.subject,body:m.body});setEdit(true);}}>Edit</button>
    {!email&&<button className="btn" onClick={async()=>{try{await navigator.clipboard.writeText(m.body);notify("Copied. Paste it into LinkedIn.");}catch{notify("Select the text and copy it.",true);}}}><Copy size={14}/>Copy for LinkedIn</button>}
    {m.status!=="Rejected"&&<button className="btn quiet" disabled={busy} onClick={()=>act("reject",a.id,{},"Draft rejected.")}>Reject</button>}
   </div>}
   {sent&&<div className="row"><span className="hint">Sent <DateText value={m.dispatchedAt} long/>. {a.name} moved to Contacted.</span><button className="btn" onClick={()=>go("results")}>See results</button></div>}
  </article>
 </div>;
}

export function Outreach(props){
 const {s,ranked,go,view}=props;const list=ranked.filter(a=>s.messages[a.id]);
 const a=list.find(x=>x.id===view.id)||list[0];
 if(!a)return <section className="screen narrow"><h1>No emails yet</h1><p className="lede">Open a prospect, approve its numbers, and choose Write the email. The draft lands here for your approval.</p><button className="btn primary" onClick={()=>go("prospects")}>Choose a prospect</button></section>;
 return <section className="screen">
  <h1>Email to {a.name}</h1>
  <p className="lede">Five agents pass the draft along. The reviewer sends back anything a source does not support. Nothing goes out until you approve the exact text.</p>
  {list.length>1&&<div className="picker">{list.map(x=><button key={x.id} aria-pressed={x.id===a.id} className={x.id===a.id?"on":""} onClick={()=>go("outreach",x.id)}><Company a={x}/>{x.name}<small>{s.messages[x.id].status==="Dispatched"?"Sent":s.messages[x.id].status}</small></button>)}</div>}
  <Letter key={a.id+s.messages[a.id].status} {...props} a={a} m={s.messages[a.id]} animate={view.tab==="new"&&s.messages[a.id].status==="Pending"}/>
 </section>;
}

export function Results({s,ranked,act,go,busy}){
 const [judge,setJudge]=useState(false),metric=precision(s),data=conversion(ranked),pct=(n,d)=>d?Math.round(100*n/d)+"%":"0%";
 const names=[...new Set([...ranked.map(x=>x.name),...evaluationPool])];
 return <section className="screen">
  <h1>Results</h1>
  <p className="lede">Move accounts along as replies come in. Changes you make here are marked as manual.</p>
  <dl className="tally"><div><dt>Prospects</dt><dd>{ranked.length}</dd></div><div><dt>Contacted</dt><dd>{ranked.filter(a=>a.visited.includes("Contacted")).length}</dd></div><div><dt>Meetings</dt><dd>{ranked.filter(a=>a.visited.includes("Meeting booked")).length}</dd></div><div><dt>Right picks in the top 5</dt><dd>{metric.score===null?benchmarkResult.correct+" of 5":Math.round(metric.score*5)+" of 5"}</dd></div></dl>
  <div className="board">{stageNames.map(stage=>{const col=ranked.filter(a=>a.stage===stage);return <section key={stage}><h2>{stage}<small>{col.length}</small></h2>{col.map(a=><div key={a.id} className="card"><button onClick={()=>go("account",a.id)}><Company a={a}/>{a.name}</button><select aria-label={"Stage for "+a.name} value={stage} disabled={busy} onChange={e=>act("stage",a.id,{stage:e.target.value})}>{stageNames.map(n=><option key={n}>{n}</option>)}</select></div>)}</section>;})}</div>
  <h2 className="sub">Who converts</h2>
  <div className="table-scroll"><table className="grid"><thead><tr><th>Group</th><th>Accounts</th><th>Contacted</th><th>Replied</th><th>Meeting</th></tr></thead><tbody>{[...data.tier,...data.route].map(r=><tr key={r.name}><th>{r.name}</th><td>{r.total}</td><td>{pct(r.contacted,r.total)}</td><td>{pct(r.replied,r.total)}</td><td>{pct(r.meetings,r.total)}</td></tr>)}</tbody></table></div>
  {s.mode==="rehearsal"&&<Benchmark/>}
  <div className="row"><button className="btn" onClick={()=>setJudge(true)}>Label companies yourself</button><span className="hint">Mark 20 companies as a fit or not to score this run's top 5.</span></div>
  {judge&&<Modal title="Label companies" close={()=>setJudge(false)}><p className="hint">{metric.total} labeled{metric.score!==null&&", "+Math.round(metric.score*100)+"% of the top 5 are a fit"}.</p><div className="labels">{names.map(n=><label key={n}><span>{n}</span><select value={typeof s.labels[n]==="boolean"?String(s.labels[n]):""} disabled={busy} onChange={e=>act("label",null,{name:n,fit:e.target.value===""?null:e.target.value==="true"})}><option value="">Not labeled</option><option value="true">Fit</option><option value="false">Not a fit</option></select></label>)}</div></Modal>}
 </section>;
}

const providerInfo=[["anthropic","Claude","Builds the profile, reads sources, writes the email"],["tavily","Tavily","Searches the web and re-reads each cited page"],["neo4j","Neo4j","Finds warm introductions and unhappy incumbents"],["hunter","Hunter","Finds and verifies work emails"],["band","Band","Runs the five agents and their handoffs"],["gmail","Gmail","Sends approved emails to your test inbox"],["flexprice","Flexprice","Meters usage and blocks paid actions at zero credits"]];
export function Usage({s,act,busy,providers,openConnect}){
 const [tab,setTab]=useState("Credits"),[reset,setReset]=useState(false);
 return <section className="screen">
  <h1>{s.credits} credits left</h1>
  <p className="lede">Searching and reading are free. Four actions cost credits, and each is checked against the balance before it runs.</p>
  <Tabs tabs={["Credits","Agent log","Services"]} value={tab} onChange={setTab} label="Usage"/>
  {tab==="Credits"&&<div className="stack">
   <dl className="tally">{Object.entries(rates).map(([k,v])=><div key={k}><dt>{activityLabels[k]}</dt><dd>{v}</dd></div>)}</dl>
   {s.mode==="rehearsal"&&<CreditBlockTest/>}
   <div className="table-scroll"><table className="grid"><thead><tr><th>Action</th><th>Account</th><th>Agent</th><th>Credits</th></tr></thead><tbody>{s.usage.length?s.usage.map(e=><tr key={e.id}><th>{activityLabels[e.kind]}</th><td>{s.accounts.find(a=>a.id===e.account)?.name||e.account}</td><td>{e.agent}</td><td>−{e.cost}</td></tr>):<tr><td colSpan="4" className="hint">Nothing spent yet.</td></tr>}</tbody></table></div>
   <h2 className="sub">Budget per agent</h2>
   <dl className="tally">{allocation(s).map(x=><div key={x.agent}><dt>{x.agent}</dt><dd>{x.used} of {x.planned}</dd></div>)}</dl>
  </div>}
  {tab==="Agent log"&&(s.activity.length?<ol className="log">{s.activity.map((x,i)=><li key={i}><b>{x.actor}</b><span>{x.title}{x.details&&<small>{x.details}</small>}</span><time><DateText value={x.at}/></time></li>)}</ol>:<Empty title="Nothing logged yet"><p>Start from the product step.</p></Empty>)}
  {tab==="Services"&&<div className="stack"><ul className="services">{providerInfo.map(([k,n,info])=><li key={k}><b>{n}</b><span>{info}</span>{providers.configured?.[k]?<Chip tone="green">Connected</Chip>:<Chip>Not connected</Chip>}</li>)}</ul>{providers.requiresToken&&<button className="btn" onClick={openConnect}>Connect the live workspace</button>}<p className="hint">{s.mode==="live"?"Live workspace.":"Demo workspace. Everything runs offline on saved research."}</p></div>}
  {s.mode==="rehearsal"&&<div className="row"><button className="btn quiet" onClick={()=>setReset(true)}>Reset the demo</button></div>}
  {reset&&<Modal title="Reset the demo?" close={()=>setReset(false)}><p className="hint">This restores the five saved prospects and 10 credits, and clears drafts, approvals and the log.</p><div className="row"><button className="btn" onClick={()=>setReset(false)}>Cancel</button><button className="btn primary" disabled={busy} onClick={async()=>{if(await act("reset",null,{},"Demo reset."))setReset(false);}}>Reset</button></div></Modal>}
 </section>;
}
