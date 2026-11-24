import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {financeFields,initialInputs,businessCase} from "../lib/finance.mjs";
import {initialState,applyAction,inputsFor,precision,draftFor,evaluationPool} from "../lib/workspace.mjs";
import {orderedAccounts,score} from "../lib/scoring.mjs";
import {relationship} from "../lib/relationships.mjs";
import {runRole} from "../lib/handoffs.mjs";
import {summarizeBenchmark} from "../lib/benchmark.mjs";
const seed=JSON.parse(readFileSync(new URL("../data/prospects.json",import.meta.url)));
const fresh=()=>initialState(seed);
const action=(s,kind,id="exa",payload={},env={})=>applyAction(s,{kind,id,payload},{seed,prospects:seed,...env});
async function draft(){return action(await action(fresh(),"case","exa",{approve:true}),"draft");}

test("base economics distinguish capacity from dollars leaving the bank",()=>{
 const m=businessCase(initialInputs());
 assert.equal(m.build,84000);assert.equal(m.buy,17500);assert.equal(m.net,66500);assert.equal(m.cashNet,-10000);
 assert.ok(Math.abs(m.capacity-5.1)<0.001);assert.ok(m.payback>0&&m.payback<1);assert.ok(Math.abs(m.curve.at(-1)-m.net)<1e-8);
});
test("sensitivity, missing values, unprofitable cases, zero cost and capped year",()=>{
 const x=initialInputs();assert.ok(businessCase(x,"Conservative").net<businessCase(x).net);assert.ok(businessCase(x,"Optimistic").net>businessCase(x).net);
 assert.equal(businessCase(initialInputs(false)).complete,false);x.months.value=60;assert.equal(businessCase(x).build,180000);
 x.subscription.value=120000;assert.ok(businessCase(x).net<0);assert.equal(businessCase(x).payback,null);
 Object.values(x).forEach(f=>f.value=0);assert.equal(businessCase(x).roi,null);
 x.rate.value=-1;assert.equal(businessCase(x).complete,false);
});
test("reference corpus has five real companies and thirteen checked, attributable excerpts",()=>{
 const s=fresh();assert.equal(s.accounts.length,5);assert.equal(s.accounts.flatMap(a=>a.sources).length,13);
 for(const a of s.accounts)for(const e of a.sources){assert.equal(e.verified,true);assert.ok(new URL(e.url).hostname);assert.ok(e.quote.length>12);}
});
test("the source-based fit benchmark covers the defined pool and handles an unjudged top five",()=>{
 const benchmark=JSON.parse(readFileSync(new URL("../data/fit-benchmark.json",import.meta.url)));
 assert.deepEqual(new Set(benchmark.judgments.map(row=>row.name)),new Set(evaluationPool));
 assert.ok(benchmark.judgments.every(row=>new URL(row.url).protocol==="https:"&&row.reason.length>10));
 const result=summarizeBenchmark(fresh(),benchmark);
 assert.equal(result.count,20);assert.equal(result.relevant,16);assert.equal(result.correct,5);
 assert.equal(summarizeBenchmark(initialState([]),benchmark).correct,null);
});
test("discovery needs an approved ICP; an unchanged approval preserves the shortlist",async()=>{
 let s=fresh();s.icp.approved=false;await assert.rejects(action(s,"discover"),/approve/i);
 s=await action(s,"profile",null,{approved:true,fields:s.icp.fields});assert.equal(s.accounts.length,5);
 const fields=structuredClone(s.icp.fields);fields.segments.value="unrepresented test sector";s=await action(s,"profile",null,{approved:true,fields});assert.equal(s.accounts.length,0);
});
test("unverified, undated, aged and negative evidence receive the appropriate weight",()=>{
 const s=fresh(),a=s.accounts[0];
 const base=score(a,s.icp,s.asOf);const lower=score({...a,sources:a.sources.map(e=>({...e,verified:false}))},s.icp,s.asOf);assert.ok(base.priority>lower.priority);
 const signal={...a.sources[0],kind:"hiring",published:"2026-10-25"};assert.ok(Math.abs(score({...a,sources:[signal]},s.icp,s.asOf).intent-12.5)<1e-6);
 assert.equal(score({...a,sources:[{...signal,published:null}]},s.icp,s.asOf).intent,0);assert.ok(score({...a,sources:[{...signal,kind:"negative"}]},s.icp,s.asOf).intent<0);
});
test("warm paths need a confirmed reference; displacement needs named vendor friction",async()=>{
 let s=fresh();const modal=s.accounts.find(a=>a.id==="modal"),bb=s.accounts.find(a=>a.id==="browserbase");
 assert.equal(relationship(s,modal,"warm"),null);s.product.customers="Spotify";assert.match(relationship(s,modal,"warm").reason,/Spotify/);
 assert.equal(relationship(s,bb,"displacement"),null);
 const withSignal={...bb,sources:[...bb.sources,{verified:true,kind:"dissatisfaction",incumbent:"Stripe Billing",published:s.asOf,url:"https://example.com/evidence"}]};
 assert.match(relationship(s,withSignal,"displacement").reason,/Stripe Billing/);s=await action(s,"graph","modal",{name:"warm"});assert.equal(s.accounts.find(a=>a.id==="modal").route,"Warm introduction");
});
test("one character, recipient or channel change invalidates exact approval",async()=>{
 let s=await action(await draft(),"approve");const hash=s.messages.exa.approval.hash;assert.equal(hash.length,64);
 s=await action(s,"edit","exa",{body:s.messages.exa.body+" "});assert.equal(s.messages.exa.status,"Pending");await assert.rejects(action(s,"send"),/approval/i);
 s=await action(s,"edit","exa",{recipient:"buyer@example.org"});await assert.rejects(action(s,"approve"),/test inbox/);
 let ln=await action(await draft(),"draft","exa",{channel:"LinkedIn"});await assert.rejects(action(ln,"approve"),/email/i);
});
test("dispatch cannot repeat and paid failures do not spend credits",async()=>{
 let s=await action(await draft(),"approve");s=await action(s,"send");assert.equal(s.outbox.length,1);assert.equal(s.credits,8);assert.equal(s.accounts[0].stage,"Contacted");
 await assert.rejects(action(s,"send"));await assert.rejects(action(s,"edit"));s.credits=0;await assert.rejects(action(s,"enrich"),/Insufficient credits/);assert.equal(s.usage.length,2);
});
test("cases, resetting, evaluation and revised inputs preserve honest state",async()=>{
 let s=await action(await draft(),"approve");const inputs=inputsFor(s,"exa");inputs.months={value:0,origin:"User provided",source:null};s=await action(s,"case","exa",{inputs,approve:false});assert.equal(s.messages.exa,undefined);
 assert.equal(precision(s).score,null);for(const name of evaluationPool)s=await action(s,"label",null,{name,fit:name==="Exa"});assert.equal(precision(s).score,0.2);
 const next=await action(s,"reset");assert.equal(next.revision,s.revision+1);assert.equal(next.credits,10);assert.deepEqual(next.labels,{});
});
test("all five Band roles do work and the reviewer sends an unsubstantiated claim back",async()=>{
 const s=await action(fresh(),"case","exa",{approve:true}),a=s.accounts[0];const packet={account:a,approved:true,product:s.product,budget:s.credits,financial:businessCase(inputsFor(s,"exa")),body:draftFor(s,a)};
 let role="PLANNER",out={},steps=[];while(role!=="HUMAN"&&steps.length<10){steps.push(role);out=runRole(role,packet,out);role=out.next;}
 assert.deepEqual(steps,["PLANNER","RESEARCHER","ANALYST","WRITER","REVIEWER","WRITER","REVIEWER"]);assert.equal(out.body,packet.body.body);
});
