"use client";
import {Check,Lock} from "lucide-react";
import {Mark,Num} from "./ui";

const steps=[
 ["Product","You enter what the product does, its main capabilities, its price and any existing customers. Each capability is rewritten as the result a buyer pays for.",["AI model"]],
 ["Ideal customer","The AI model proposes who should buy: segment, company size, buyer role, buying signals and exclusions, each with a confidence and a reason. If you list customers, it looks for what they have in common. You edit and approve. Nothing is searched before that.",["AI model"]],
 ["Prospects","Tavily searches the web for candidate companies, then searches each company's own site. The AI model pulls short quotes about pricing, launches, funding or hiring, and a quote is kept only if its exact words are found again on a fresh copy of the page. Companies are ranked by fit plus a buying signal that loses weight as it ages, times evidence strength. For each company, code compares building in-house with buying, and Hunter can find the buyer's verified email.",["Tavily","AI model","Code","Hunter, optional"]],
 ["Outreach","Five agents pass the job along in a Band room. The Planner sets the budget, the Researcher re-checks the quotes, the Analyst adds the approved numbers, the Writer drafts, and the Reviewer sends back any claim a source does not support. You approve the exact text, and changing one character asks you again.",["Band","AI model"]],
 ["Results","The approved email goes to your test inbox. Flexprice checks the credit balance before every paid action, records the usage, and blocks the action at zero. The pipeline tracks each account's stage, conversion by tier and route, and how many of the top five picks were right.",["Flexprice","Gmail, optional"]],
];
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

  <section className="how" id="how">
   <h2>How it works</h2>
   <p className="lede">Five steps, the same ones you see at the top of the app.</p>
   <ol>{steps.map(([t,d,uses],i)=><li key={t}><span className="n">{i+1}</span><b>{t}</b><p>{d}</p><span className="uses">{uses.map(u=><i key={u}>{u}</i>)}</span></li>)}</ol>
  </section>

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
