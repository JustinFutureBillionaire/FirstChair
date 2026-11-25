"use client";
import {useEffect,useRef,useState} from "react";
import {ArrowDown,Check,CornerUpLeft,Lock,RotateCcw,Search} from "lucide-react";
import {Mark,Num} from "./ui";

const steps=[
 {name:"Product",line:"Type what you sell. Each capability becomes a buyer benefit.",uses:["AI model"]},
 {name:"Ideal customer",line:"The AI proposes who should buy, with a confidence for each line. You approve.",uses:["AI model"]},
 {name:"Prospects",line:"Tavily finds companies. A quote only counts if it is found again on the page.",uses:["Tavily","AI model"]},
 {name:"Outreach",line:"Five agents in Band draft and check the email. The Reviewer can send it back.",uses:["Band","AI model"]},
 {name:"Results",line:"Flexprice charges credits per action and blocks at zero. You track replies.",uses:["Flexprice"]},
];

function ProductVisual(){return <div className="hw-v hw-product">
 <div className="hw-field"><small>Capability</small><span className="hw-type">Usage metering</span></div>
 <ArrowDown size={20} className="hw-down"/>
 <div className="hw-benefit"><small>What a buyer hears</small><p>Measure usage without building an event ledger.</p></div>
</div>;}

const icp=[["Segment","AI infrastructure, developer tools",90],["Buyer role","Head of engineering",78],["Buying signal","Pricing changes, billing hires",83],["Company size","10 to 200 employees",60]];
function CustomerVisual(){return <div className="hw-v hw-icp">
 {icp.map(([k,v,c],i)=><div key={k} className="hw-row" style={{"--i":i}}><b>{k}</b><span>{v}</span><span className="hw-bar"><i style={{"--w":c+"%"}}/></span><small>{c}%</small></div>)}
 <span className="hw-stamp"><Check size={14} strokeWidth={3}/>Approved</span>
</div>;}

const found=["Exa","Modal","Firecrawl","Browserbase","Tavily"];
const ranked=[["Modal",81],["Exa",80],["Firecrawl",75]];
function ProspectsVisual(){return <div className="hw-v hw-prospects">
 <div className="hw-search"><Search size={14}/>{found.map((n,i)=><span key={n} style={{"--i":i}}>{n}</span>)}</div>
 <div className="hw-quote"><mark>Usage now draws down from your existing Exa credits</mark><p><Check size={13}/>Found again on exa.ai</p></div>
 <ol className="hw-rank">{ranked.map(([n,sc],i)=><li key={n} style={{"--i":i}}><span>{i+1}</span><b>{n}</b><span className="hw-bar"><i style={{"--w":sc+"%"}}/></span><em>{sc}</em></li>)}</ol>
</div>;}

const chain=[["Planner","Plans the research"],["Researcher","Re-checks 2 quotes"],["Analyst","Adds the approved $66,500"],["Writer","Drafts the email"],["Reviewer","Sends it back: no source says they plan to switch",true],["Writer","Rewrites without that claim"],["Reviewer","Every claim and number checks out"],["You","Approve the exact text"]];
function OutreachVisual(){return <ol className="hw-v hw-chain">{chain.map(([who,what,bad],i)=><li key={i} className={(bad?"bad ":"")+(who==="You"?"you":"")} style={{"--i":i}}><b>{who}</b><span>{bad&&<CornerUpLeft size={13}/>}{what}</span></li>)}</ol>;}

function ResultsVisual(){return <div className="hw-v hw-results">
 <div className="hw-wallet"><small>Credits</small><b><span>10</span><span>9</span><span>8</span></b></div>
 <ul className="hw-ledger"><li style={{"--i":0}}>Business case approved<em>−1</em></li><li style={{"--i":1}}>Email sent<em>−1</em></li><li className="block" style={{"--i":2}}>At 0 credits the next action is blocked</li></ul>
 <div className="hw-board"><div><small>Matched</small></div><div><small>Contacted</small></div><span className="hw-card">Exa</span></div>
</div>;}

const visuals=[ProductVisual,CustomerVisual,ProspectsVisual,OutreachVisual,ResultsVisual];

function HowItWorks(){
 const [at,setAt]=useState(0),[run,setRun]=useState(0),stage=useRef(null);
 const pick=i=>{setAt(i);setRun(r=>r+1);};
 // Replay the first step when the section scrolls into view, so it is not over before anyone sees it.
 useEffect(()=>{const el=stage.current;if(!el||!("IntersectionObserver" in window))return;
  const io=new IntersectionObserver(([e])=>{if(e.isIntersecting){setRun(r=>r+1);io.disconnect();}},{threshold:.5});io.observe(el);return ()=>io.disconnect();},[]);
 const V=visuals[at];
 return <section className="how" id="how">
  <h2>How it works</h2>
  <div className="hw">
   <ol className="hw-steps" role="tablist" aria-label="Steps">{steps.map((x,i)=><li key={x.name}><button role="tab" aria-selected={i===at} className={i===at?"on":""} onClick={()=>pick(i)}>
    <span className="n">{i+1}</span><span><b>{x.name}</b>{i===at&&<><p>{x.line}</p><span className="uses">{x.uses.map(u=><i key={u}>{u}</i>)}</span></>}</span></button></li>)}</ol>
   <div ref={stage} className="hw-stage" role="tabpanel" aria-label={steps[at].name}>
    <V key={at+"-"+run}/>
    <div className="hw-controls"><button className="btn small quiet" onClick={()=>setRun(r=>r+1)}><RotateCcw size={13}/>Replay</button>{at<steps.length-1?<button className="btn small" onClick={()=>pick(at+1)}>Next: {steps[at+1].name}</button>:<button className="btn small" onClick={()=>pick(0)}>Start over</button>}</div>
   </div>
  </div>
 </section>;
}
const rules=[
 ["Every quote is read twice","A claim only counts after its exact words are found again on a fresh copy of the page."],
 ["Numbers come from code","The model reads and writes. The business case and the score are plain arithmetic you can open and edit."],
 ["You approve what is sent","Approval is tied to the exact recipient, subject and body. Edit anything and it needs your approval again."],
];

export function Landing({go,s}){
 const start=()=>go("product");
 return <div className="landing">
  <header className="l-bar"><button className="brand" onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}><Mark/><span>First Chair</span></button>
   <nav><a href="#how">How it works</a><a href="#rules">Why trust it</a><button className="btn primary small" onClick={start}>Start with my product</button></nav></header>

  <section className="hero">
   <div className="hero-copy">
    <h1>Know which companies need your product this week, and why.</h1>
    <p className="lede">Describe what you sell. First Chair finds companies with a fresh buying signal, quotes the line on their own site that shows it, works out whether buying beats building for them, and drafts an email you approve word for word.</p>
    <div className="row"><button className="btn primary big" onClick={start}>Start with my product</button><a className="btn big" href="#how">See how it works</a></div>
    <p className="hint">No sign-up. {s.mode==="live"?"Connected to live search and agents.":"The demo runs on research saved on November 24, 2026."}</p>
   </div>

   <figure className="specimen" aria-label="Example result for Exa">
    <div className="sp-head"><span className="sp-co">E</span><div><b>Exa</b><small>exa.ai, search infrastructure</small></div><span className="sp-score"><b><Num value={80}/></b><i>A</i></span></div>
    <p className="sp-label">Why now, Nov 17</p>
    <blockquote><mark>Usage now draws down from your existing Exa credits</mark></blockquote>
    <p className="sp-check"><Check size={13}/>Found again on exa.ai/blog/websets-v2</p>
    <div className="sp-math"><div><small>Build in-house</small><b>$84,000</b></div><div><small>Buy Flexprice</small><b>$17,500</b></div><div className="sp-net"><small>Year-one advantage</small><b>$66,500</b></div></div>
    <div className="sp-mail"><p>I read Exa’s <mark>“Websets v2”</mark>. Flexprice helps with usage metering. Under the build assumptions we modeled, the advantage would be <u>$66,500</u>.</p><span><Lock size={12}/>Approved, locked to this exact text</span></div>
   </figure>
  </section>

  <HowItWorks/>

  <section className="rules" id="rules">
   <h2>Nothing reaches a buyer unchecked</h2>
   <dl>{rules.map(([t,d])=><div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
  </section>

  <section className="l-end">
   <h2>Try it on the example, or on your own product.</h2>
   <button className="btn primary big" onClick={start}>Start with my product</button>
   <p className="hint">Built with Tavily, Band and Flexprice.</p>
  </section>
 </div>;
}
