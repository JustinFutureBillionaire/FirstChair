import {readFileSync} from "node:fs";
import {applyAction, initialState, inferProfile, inputsFor, moneySummary, draftFor, rates, roleFor} from "../lib/workspace.mjs";
import {businessCase} from "../lib/finance.mjs";
import {runRole} from "../lib/handoffs.mjs";
import {orderedAccounts} from "../lib/scoring.mjs";
const seed=JSON.parse(readFileSync(new URL("../data/prospects.json",import.meta.url)));
try {
 const {state,action,context={},method}=JSON.parse(readFileSync(0,"utf8"));
 let result;
 if(method==="initial")result=initialState(seed,!context.live);
 else if(method==="profile")result=inferProfile(action.payload);
 else if(method==="describe")result={rates,roles:roleFor};
 else if(method==="role")result=runRole(action.role,context.packet,context.prior);
 else if(method==="packet"){
   const a=orderedAccounts(state).find(x=>x.id===action.id);
   if(!a)throw Error("Research the account first.");
   result={account:a,product:state.product,profile:state.icp,budget:state.credits,financial:moneySummary(state,a.id),approved:!!state.reviewedCases[a.id],body:draftFor(state,a,action.payload?.channel==="LinkedIn"?"LinkedIn":"Email"),inputs:inputsFor(state,a.id)};
 }else result=await applyAction(state,action,{seed,prospects:seed,...context});
 process.stdout.write(JSON.stringify({ok:true,result}));
}catch(err){process.stdout.write(JSON.stringify({ok:false,error:err.message}));}
