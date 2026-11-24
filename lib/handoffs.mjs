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
    const draft={...p.body};
    const hypothesis="The company plans to replace its current billing provider.";
    return {next:"REVIEWER",summary:prior.revision?"Revised copy asks the buyer to validate its assumptions.":"Proposed copy and a buying-intent claim for review.",sourceIds:[primary],subject:draft.subject,body:draft.body,claims:prior.revision?[]:[{text:hypothesis,source:primary}],revision:!!prior.revision};
  }
  case "REVIEWER": {
    if(!proof)throw Error("The cited document cannot be traced to this account.");
    const unsupported=(prior.claims||[]).find(c=>!checked.some(s=>s.id===c.source && s.quote.toLowerCase().includes(c.text.toLowerCase())));
    if(unsupported)return {next:"WRITER",revision:true,summary:"Rejected the proposed buying-intent claim. The cited source does not say the company plans to switch."};
    if(prior.subject!==p.body.subject||prior.body!==p.body.body)throw Error("The draft must match the sourced and calculated version.");
    return {next:"HUMAN",summary:"Checked sources and conditional financial language. Ready for exact-message approval.",subject:prior.subject,body:prior.body,sourceIds:[primary]};
  }
  default:throw Error("Unknown Band role.");
 }
}
