"use client";
import {useState} from "react";
import {ArrowLeft,ArrowUpRight,Check} from "lucide-react";
import {businessCase,dollars,financeFields,scenarios} from "../lib/finance.mjs";
import {inputsFor} from "../lib/workspace.mjs";
import {Chip,Company,Num,Quote,Tier} from "./ui";

const money=v=>dollars(Math.round(v));

function Score({a}){
 const sc=a.scoring;
 return <div className="score-card">
  <div className="big"><b><Num value={sc.priority}/></b><Tier value={sc.tier}/></div>
  <dl>
   <div><dt>Fit to your profile</dt><dd><span className="meter"><i style={{"--w":sc.fit*2+"%"}}/></span>{sc.fit} of 50</dd></div>
   <div><dt>Buying signal</dt><dd><span className="meter"><i style={{"--w":Math.max(0,sc.intent)*2+"%"}}/></span>{sc.intent.toFixed(1)} of 50</dd></div>
   <div><dt>Evidence strength</dt><dd><span className="meter"><i style={{"--w":sc.quality*100+"%"}}/></span>×{sc.quality.toFixed(2)}</dd></div>
  </dl>
  <p>Priority is fit plus signal times evidence strength. Signals lose half their weight every 30 to 90 days.</p>
 </div>;
}

function Compare({s,a,model,inputs}){
 const v=k=>Number(inputs[k].value)||0, inc=a.incumbent;
 const cols=["Build it in-house",...(inc?[inc.name+" (today)"]:[]),s.product.name];
 const rows=[
  ["First-year cost",[money(model.build),...(inc?["Unknown"]:[]),money(model.buy)]],
  ["Engineering to start",[v("months")+" engineer-months",...(inc?["Already live"]:[]),v("integration")+" engineer-months"]],
  ["Engineering to keep running",[v("maintenance")+"% of an engineer",...(inc?["Unknown"]:[]),"Vendor maintained"]],
  ["Switching cost",["None",...(inc?["None"]:[]),inc?"Migration from "+inc.name+", to confirm":money(model.upfront)+" integration"]],
 ];
 return <div className="table-scroll"><table className="grid"><thead><tr><th/>{cols.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map(([n,cells])=><tr key={n}><th>{n}</th>{cells.map((c,i)=><td key={i}>{c}</td>)}</tr>)}</tbody></table></div>;
}

function Money({s,a,act,go,busy}){
 const saved=inputsFor(s,a.id),[inputs,setInputs]=useState(()=>structuredClone(saved)),[scenario,setScenario]=useState("Base");
 const model=businessCase(inputs,scenario),dirty=JSON.stringify(inputs)!==JSON.stringify(saved),approved=s.reviewedCases[a.id]&&!dirty;
 const change=(key,value,origin="User provided")=>setInputs(old=>({...old,[key]:{value:value===""||value===null?null:Number(value),origin:value===""||value===null?"Unknown":origin,source:old[key].origin==="Public"&&origin==="Public"?old[key].source:null}}));
 async function approve(){if(await act("case",a.id,{inputs,approve:true},"Business case approved."))return true;return false;}
 async function write(){if(s.messages[a.id]||await act("draft",a.id,{channel:"Email"}))go("outreach",a.id,"new");}
 const top=Math.max(model.build||0,model.buy||0,1);
 return <div className="money">
  {model.complete?<>
  <div className="verdict">
   <div><p>Year-one advantage of buying {s.product.name}</p><b className={model.net<0?"neg":""}><Num value={model.net} format={money}/></b><p>{model.net>0?"Buying costs less than building under these assumptions.":"Building costs less under these assumptions. Say so in the email, or skip this account."}</p></div>
   <div className="seg" role="radiogroup" aria-label="Scenario">{Object.keys(scenarios).map(n=><button key={n} role="radio" aria-checked={n===scenario} className={n===scenario?"on":""} onClick={()=>setScenario(n)}>{n}</button>)}</div>
  </div>
  <div className="versus">
   <div><span>Build in-house</span><span className="meter"><i style={{"--w":model.build/top*100+"%"}}/></span><b><Num value={model.build} format={money}/></b></div>
   <div className="buy"><span>Buy {s.product.name}</span><span className="meter"><i style={{"--w":model.buy/top*100+"%"}}/></span><b><Num value={model.buy} format={money}/></b></div>
  </div>
  <label className="slider"><span>How long would {a.name} take to build it? <b>{inputs.months.value} engineer-months</b></span><input type="range" min="0.5" max="12" step="0.5" value={inputs.months.value??4} onChange={e=>change("months",e.target.value)}/></label>
  <dl className="facts"><div><dt>Return on cost</dt><dd>{model.roi===null?"n/a":<Num value={model.roi} format={v=>Math.round(v)+"%"}/>}</dd></div><div><dt>Pays back in</dt><dd>{model.payback===null?"over a year":model.payback.toFixed(1)+" months"}</dd></div><div><dt>Cash out of pocket</dt><dd><Num value={model.cashNet} format={money}/></dd></div></dl>
  <p className="hint">The advantage counts engineering time saved. That time turns into cash only if the team would really cut the spend. A positive case does not mean the buyer has budget.</p>
  </>:<p className="hint">Add a value for {model.missing.toLowerCase()} to finish the model.</p>}
  <details><summary>Compare the options</summary>{model.complete&&<Compare s={s} a={a} model={model} inputs={inputs}/>}</details>
  <details><summary>Every assumption and where it came from</summary><div className="table-scroll"><table className="grid assumptions"><tbody>{Object.entries(financeFields).map(([k,f])=><tr key={k}><th><label htmlFor={"in-"+k}>{f.label}</label></th><td><input id={"in-"+k} type="number" min="0" max={f.max} step="any" value={inputs[k].value??""} onChange={e=>change(k,e.target.value)}/><small>{f.unit}</small></td><td>{inputs[k].source?<a href={inputs[k].source} target="_blank" rel="noreferrer">{inputs[k].origin}<ArrowUpRight size={12}/></a>:<Chip tone={inputs[k].origin==="Unknown"?"red":"quiet"}>{inputs[k].origin}</Chip>}</td></tr>)}</tbody></table></div></details>
  <div className="row">{approved?<><Chip tone="green"><Check size={12}/> Approved</Chip><button className="btn primary" disabled={busy} onClick={write}>{s.messages[a.id]?"Open the email":"Write the email"}</button></>:<button className="btn primary" disabled={busy||!model.complete} onClick={approve}>Approve these numbers</button>}<span className="hint">{approved?"The writer may quote the approved figure.":"Approving uses 1 credit. The email can only quote approved numbers."}</span></div>
 </div>;
}

function Paths({s,a,act,busy}){
 const checks=[["warm","Warm introduction","Someone at "+a.name+" used to work at one of your customers."],["displacement","Unhappy with a current vendor","A recent public complaint about the tool they use today."]];
 return <div className="paths">{checks.map(([k,title,desc])=>{const r=s.graphResults[a.id+":"+k];return <div key={k} className={r?(r.matched?"hit":"miss"):""}>
  <h3>{title}</h3><p>{r?r.result:desc}</p>
  {!r&&<button className="btn small" disabled={busy} onClick={()=>act("graph",a.id,{name:k})}>Check (1 credit)</button>}
 </div>;})}
 {a.id==="modal"&&!s.product.customers&&<p className="hint">Try it: add Spotify as an existing customer on the product step. Modal's founder used to work there.</p>}
 </div>;
}

export function Account(props){
 const {s,selected,ranked,go,act,busy}=props,a=ranked.find(x=>x.id===selected.id);
 return <section className="screen account">
  <button className="back" onClick={()=>go("prospects")}><ArrowLeft size={14}/>All prospects</button>
  <header className="acct-head"><Company a={a} large/><div><h1>{a.name}</h1><p><a href={"https://"+a.domain} target="_blank" rel="noreferrer">{a.domain}</a>, {a.segment.toLowerCase()}</p></div></header>
  <div className="acct-grid">
   <div className="acct-main">
    <section className="part" style={{"--i":0}}><h2><span className="n">1</span>Why now</h2><div className="quotes">{a.sources.map((x,i)=><Quote key={x.id} source={x} delay={i*120}/>)}</div></section>
    <section className="part" style={{"--i":1}}><h2><span className="n">2</span>Is it worth it for them</h2><Money key={a.id} {...props} a={a}/></section>
    <section className="part" style={{"--i":2}}><h2><span className="n">3</span>Who to write to</h2>
     <div className="who-card"><div><b>{a.persona}</b><p>{a.contact?.email?a.contact.email:a.contact?"No verified address found. The demo sends to your team inbox.":"Hunter finds the work email and checks it can receive mail."}</p>{a.contact&&<Chip tone={a.contact.email?"green":"quiet"}>{a.contact.email?"Verified":"Not verified"}</Chip>}</div>{!a.contact&&<button className="btn small" disabled={busy} onClick={()=>act("enrich",a.id)}>Find their email (2 credits)</button>}</div>
     <Paths {...props} a={a}/></section>
   </div>
   <aside className="acct-side"><Score a={a}/></aside>
  </div>
 </section>;
}
