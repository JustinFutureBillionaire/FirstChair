"use client";
import {useCallback,useEffect,useState} from "react";
import {Check,LoaderCircle} from "lucide-react";
import {Chip,Company,DateText,Num,Tier,reduced} from "./ui";
import {benefitMap,defaultProduct,featureSource} from "../lib/workspace.mjs";

const intake=[
 ["name","Product name","input"],
 ["description","What it does","textarea"],
 ["capabilities","Main capabilities, one per line","textarea"],
 ["pricing","Pricing","input"],
 ["customers","Existing customers (optional)","input"],
 ["constraints","Markets you want, or want to avoid (optional)","input"],
];

export function Product({s,act,go,busy}){
 const [p,setP]=useState({...s.product});
 const changed=JSON.stringify(p)!==JSON.stringify(s.product), example=s.product.name===defaultProduct.name;
 async function build(e){e.preventDefault();if(await act("product",null,p))go("customer","new");}
 return <section className="screen product">
  <div className="intro"><h1>What are you selling?</h1>
  <p className="lede">Describe the product the way you would to a new sales hire. First Chair works out who should buy it, finds those companies, and drafts the first email.</p>
  {example&&<p className="hint">Filled in with an example product, Flexprice. Replace it with yours, or run the example as is.</p>}</div>
  <form className="intake" onSubmit={build}>
   {intake.map(([k,label,kind])=><label key={k} className="field">{label}{kind==="textarea"?<textarea rows={k==="capabilities"?3:2} required={k==="description"||k==="capabilities"} value={p[k]} onChange={e=>setP({...p,[k]:e.target.value})}/>:<input required={k==="name"} value={p[k]} onChange={e=>setP({...p,[k]:e.target.value})}/>}</label>)}
   <div className="row">
    <button className="btn primary" disabled={busy}>Build my customer profile</button>
    {s.icp.approved&&!changed&&<button type="button" className="btn" onClick={()=>go("prospects")}>Keep the current run</button>}
   </div>
   {s.accounts.length>0&&<p className="hint">Building a new profile starts a new run and clears the current prospects and drafts.</p>}
  </form>
  <aside className="benefits" aria-live="polite"><h2>How a buyer will hear it</h2><p className="hint">Each capability, rewritten as the result a buyer pays for. It updates as you type.</p>{benefitMap(p).map((x,i)=><p key={x.feature+i} className="benefit"><b>{x.feature}</b><span>{x.benefit}</span></p>)}</aside>
 </section>;
}

export function Customer({s,act,go,busy,view}){
 const [fields,setFields]=useState(()=>structuredClone(s.icp.fields)),[exp,setExp]=useState(()=>s.icp.expansions.map(x=>x.status));
 const fresh=view.id==="new";
 async function approve(){
  const ok=await act("profile",null,{fields,expansions:s.icp.expansions.map((e,i)=>exp[i]||e.status),approved:true});
  if(ok&&await act("discover"))go("prospects","run");
 }
 const set=(k,patch)=>setFields(f=>({...f,[k]:{...f[k],...patch}}));
 return <section className={"screen narrow"+(fresh?" fresh":"")}>
  <h1>Who should buy {s.product.name}</h1>
  <p className="lede">Each line is a guess with a confidence and a reason. Edit anything that looks wrong. Nothing is searched until you approve.</p>
  <ol className="icp">{Object.entries(fields).map(([k,f],i)=><li key={k} className={f.enabled?"":"off"} style={{"--i":i}}>
   <div className="icp-head"><label htmlFor={"icp-"+k}>{f.label}</label><span className="conf" aria-hidden="true"><i style={{"--w":Math.round(f.confidence*100)+"%"}}/></span><small>{Math.round(f.confidence*100)}% sure</small></div>
   <input id={"icp-"+k} value={f.value} disabled={!f.enabled} onChange={e=>set(k,{value:e.target.value})}/>
   <p>{f.reason}</p>
   <label className="toggle"><input type="checkbox" checked={f.enabled} onChange={e=>set(k,{enabled:e.target.checked})}/>Use</label>
  </li>)}</ol>
  {s.icp.expansions.length>0&&<div className="expand"><h2>Also worth trying</h2><div>{s.icp.expansions.map((x,i)=>{const on=(exp[i]||x.status)==="Accepted";return <button key={x.name} type="button" aria-pressed={on} className={"pill"+(on?" on":"")} onClick={()=>{const n=[...exp];n[i]=on?"Suggested":"Accepted";setExp(n);}} title={x.reason}>{on&&<Check size={13}/>}{x.name}</button>;})}</div></div>}
  <div className="row sticky-actions"><button className="btn primary" disabled={busy} onClick={approve}>Approve and find companies</button><span className="hint">{s.icp.approved?"Already approved. Approving again reruns the search.":"The search starts as soon as you approve."}</span></div>
 </section>;
}

const stages=["Searching for companies that match the profile","Reading pricing pages, changelogs and announcements","Checking every quote against the page it came from","Ranking by fit, timing and evidence"];
function DiscoveryRun({s,ranked,done}){
 const quotes=ranked.flatMap(a=>a.sources.map(src=>({a,src}))).slice(0,6), total=ranked.reduce((n,a)=>n+a.sources.length,0);
 const [step,setStep]=useState(0);
 useEffect(()=>{const t=[900,1900,3900,4700].map((ms,i)=>setTimeout(()=>setStep(i+1),ms));const end=setTimeout(done,5500);return ()=>{t.forEach(clearTimeout);clearTimeout(end);};},[done]);
 return <div className="run" role="status" aria-live="polite">
  <ol>{stages.map((x,i)=><li key={x} className={step>i?"ok":step===i?"now":""}><span className="mark-icon">{step>i?<Check size={14} strokeWidth={2.5}/>:step===i?<LoaderCircle size={14} className="spin"/>:null}</span>{x}{i===2&&step>=2&&<span className="count"><Num value={step>2?total:Math.ceil(total/2)}/> of {total} confirmed</span>}</li>)}</ol>
  {step>=2&&<div className="run-quotes">{quotes.map(({a,src},i)=><p key={src.id} style={{"--d":i*300+"ms"}}><b>{a.name}</b><mark>{src.quote}</mark><Check size={14} className="ok"/></p>)}</div>}
  {s.mode!=="live"&&<p className="hint">Replaying the saved research from <DateText value={s.asOf} long/>.</p>}
 </div>;
}

export function Prospects({s,act,go,busy,ready,ranked,view}){
 const [running,setRunning]=useState(()=>view.id==="run"&&!reduced());
 const stop=useCallback(()=>setRunning(false),[]);
 if(!s.icp.approved)return <section className="screen narrow"><h1>Approve a customer profile first</h1><p className="lede">Prospects come from the profile you approve.</p><button className="btn primary" onClick={()=>go("customer")}>Review the profile</button></section>;
 return <section className="screen">
  <div className="head-row"><div><h1>{running?"Looking for companies":ranked.length+" companies need "+s.product.name+" now"}</h1><p className="lede">{running?"Every claim is checked against its source before it can count.":"Ranked by fit, how recent the buying signal is, and how strong the evidence is. Open one to build its case."}</p></div>
   {!running&&<button className="btn" disabled={busy||!ready} onClick={async()=>{if(await act("discover"))setRunning(!reduced());}}>Search again</button>}</div>
  {running?<DiscoveryRun s={s} ranked={ranked} done={stop}/>:
  <ol className="prospects">{ranked.map((a,i)=>{const src=featureSource(a);const m=s.messages[a.id];return <li key={a.id} style={{"--i":i}}><button onClick={()=>go("account",a.id)}>
   <span className="rank">{i+1}</span><Company a={a}/>
   <span className="who"><strong>{a.name}</strong><small>{a.segment}</small></span>
   <span className="why">{src?<><mark>{src.quote}</mark><small>{src.title}, <DateText value={src.published}/></small></>:<small>Fit only</small>}</span>
   <span className="score"><b>{a.scoring.priority}</b><Tier value={a.scoring.tier}/></span>
   <span className="state">{m?.status==="Dispatched"?<Chip tone="green">Sent</Chip>:m?<Chip>Draft ready</Chip>:s.reviewedCases[a.id]?<Chip>Math approved</Chip>:null}</span>
  </button></li>;})}</ol>}
 </section>;
}
