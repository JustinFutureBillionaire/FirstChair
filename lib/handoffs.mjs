import {dollars} from "./finance.mjs";
export const roles=["PLANNER","RESEARCHER","ANALYST","WRITER","REVIEWER"];
export function runRole(role,p,prior={}) {
 if(!p.approved)throw Error("A human-approved financial case is required.");
 const checked=p.account.sources.filter(x=>x.verified);
 if(!checked.length)throw Error("Reviewer needs at least one checked excerpt.");
 const primary=p.body.sourceIds[0], proof=checked.find(s=>s.id===primary);
 switch(role){
  case "PLANNER": return {next:"RESEARCHER",summary:"Research "+p.account.name+" for "+p.product.name+". Work within the available "+p.budget+" credits.",accountId:p.account.id};
  case "RESEARCHER": return {next:"ANALYST",summary:"Checked "+checked.length+" company sources.",accountId:p.account.id,sourceIds:checked.map(s=>s.id)};
  case "ANALYST": return {next:"WRITER",summary:"Approved base case: "+dollars(p.financial.net)+" economic advantage and "+dollars(p.financial.cashNet)+" cash impact.",sourceIds:checked.map(s=>s.id),net:p.financial.net};
  case "WRITER": {
    // Offline fallback. In live mode the backend replaces this turn with a Claude-written draft (providers.write_draft).
    const draft={...p.body};
    const hypothesis="The company plans to replace its current billing provider.";
    return {next:"REVIEWER",summary:prior.revision?"Revised copy asks the buyer to validate its assumptions.":"Proposed copy and a buying-intent claim for review.",sourceIds:[primary],subject:draft.subject,body:draft.body,claims:prior.revision?[]:[{text:hypothesis,source:primary}],revisions:prior.revisions||0};
  }
  case "REVIEWER": {
    if(!proof)throw Error("The cited document cannot be traced to this account.");
    const problem=review(p,prior,checked);
    if(problem){
      if((prior.revisions||0)>=2)throw Error("Reviewer rejected the draft twice: "+problem);
      return {next:"WRITER",revision:true,revisions:(prior.revisions||0)+1,feedback:problem,summary:"Rejected the draft and sent it back to the Writer. "+problem};
    }
    return {next:"HUMAN",summary:"Checked every claim against a saved excerpt and every dollar figure against the approved case. Ready for exact-message approval.",subject:prior.subject,body:prior.body,sourceIds:prior.sourceIds||[primary]};
  }
  default:throw Error("Unknown Band role.");
 }
}

const norm=v=>String(v??"").replace(/\s+/g," ").trim().toLowerCase();
// Returns the first reason to reject a draft, or null when it can go to the human.
export function review(p,draft,checked){
  if(!String(draft.subject||"").trim()||!String(draft.body||"").trim())return "The draft is empty.";
  if(/https?:\/\//i.test(draft.body))return "Links are not allowed in first-touch outreach.";
  for(const c of draft.claims||[]){
    const src=checked.find(s=>s.id===c.source);
    if(!src)return "A claim cites a source that is not verified for this account.";
    if(!norm(src.quote).includes(norm(c.quote||c.text)))return "The claim \u201c"+c.text+"\u201d is not supported by the cited excerpt.";
  }
  const f=p.financial||{};
  const allowed=new Set([f.net,f.cashNet,f.build,f.buy,f.annualVendor,f.upfront].filter(Number.isFinite).map(x=>dollars(Math.abs(x))));
  const elsewhere=[p.product?.pricing,...checked.map(s=>s.quote)].join(" ");
  const stray=(draft.body.match(/\$\d[\d,]*(?:\.\d+)?/g)||[]).map(x=>x.replace(/[,.]+$/,"")).find(x=>!allowed.has(x)&&!elsewhere.includes(x));
  if(stray)return "The figure "+stray+" does not match the approved business case.";
  return null;
}
