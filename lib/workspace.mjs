import {businessCase, initialInputs, financeFields, dollars} from "./finance.mjs";
import {relationship} from "./relationships.mjs";
import {orderedAccounts} from "./scoring.mjs";

export const stageNames = ["Matched", "Contacted", "Replied", "Meeting booked", "Closed won", "Closed lost"];
export const rates = {graph_query: 1, lead_enriched: 2, business_case_generated: 1, outreach_sent: 1};
export const roleFor = {graph_query:"Researcher", lead_enriched:"Researcher", business_case_generated:"Financial analyst", outreach_sent:"Reviewer"};
export const seedDate = "2026-11-24";
export const defaultProduct = {
  name:"Flexprice", description:"Open-source usage metering, credit wallets, and billing for software and API companies.",
  capabilities:"Usage metering\nCredit wallets\nUsage-based invoicing", pricing:"Growth starts at $500/month + 0.40% of billing.",
  limits:"Implementation effort and buyer budget need confirmation.", customers:"", constraints:"AI infrastructure and developer tools",
};
const segments = [
  ["segments","Market segment","Search infrastructure, web data APIs, cloud compute, browser infrastructure, developer tools",0.90,"The product meters digital services with variable consumption."],
  ["traits","Operating model","Credits, requests, usage, spend, invoices, CPU, browser hours",0.90,"Published usage units are evidence that metering matters."],
  ["personas","Buyer roles","Engineering, finance, developer product",0.78,"These teams design and operate billing workflows."],
  ["size","Company size","10 to 200 employees",0.60,"An initial hypothesis for founder-led sales; headcount requires evidence."],
  ["regions","Region","United States",0.65,"An editable launch market for this campaign."],
  ["triggers","Buying signals","Price changes, API launches, billing hires, funding",0.83,"These events can change billing requirements."],
  ["negatives","Exclusions","Consumer-only apps, hiring freezes",0.68,"Flag accounts with weak fit or adverse signals."],
];
const expansions = [
  {name:"GPU infrastructure",reason:"Compute is sold in time and capacity units.",status:"Suggested"},
  {name:"Developer marketplaces",reason:"A shared credit balance can span many tools.",status:"Suggested"},
];
export const evaluationPool = ["Exa","Firecrawl","Modal","Browserbase","Tavily","Replicate","fal","Deepgram","ElevenLabs","AssemblyAI","Together AI","Pinecone","Neon","Supabase","Render","Vercel","Allbirds","Warby Parker","Patagonia","Levi Strauss"];
const incumbentMap = {
  browserbase:{name:"Stripe Billing", url:"https://stripe.com/customers/browserbase", note:"Browserbase describes an existing usage-based billing implementation with Stripe."},
  tavily:{name:"Tabs", url:"https://www.tabs.com/customers/tavily", note:"Tavily's finance team describes adopting Tabs for billing and revenue workflows."},
};
export function inferProfile(product) {
  const billing = /metering|usage.based billing|credit wallet|flexprice/i.test([product.name,product.description,product.capabilities].join(" "));
  const roles = /support|service desk/i.test(product.description) ? "Head of Support, Operations" : "Operations lead, Founder";
  const fields = Object.fromEntries(segments.map(([key,label,value,confidence,reason]) => [key,{label,
    value:billing ? value : ({segments:product.constraints||"Needs review",traits:product.capabilities.replace(/\n/g,", "),personas:roles,size:"Needs review",regions:"Needs review",triggers:"Relevant expansion or hiring announcements",negatives:product.limits||"Needs review"}[key]),
    confidence:billing ? confidence : 0.45, reason:billing?reason:"Proposed from the product intake. Confirm the target before discovery.", enabled:true }]));
  return {approved:false, fields, expansions:billing?structuredClone(expansions):[
    {name:"Adjacent business services",reason:"Evaluate teams performing the same task for clients.",status:"Suggested"},
    {name:"Larger operations teams",reason:"Check whether the workflow repeats across departments.",status:"Suggested"}]};
}
export function benefitMap(product) {
  const map = {meter:"Measure usage without building an event ledger.",credit:"Control access to paid actions with a balance.",invoic:"Turn measured use into invoices.",support:"Reduce repetitive work on support requests."};
  return product.capabilities.split(/\n|;/).filter(s=>s.trim()).map(s=>({feature:s.trim(),benefit:Object.entries(map).find(([k])=>s.toLowerCase().includes(k))?.[1]||"Help the buyer complete "+s.trim().toLowerCase()+" with fewer manual steps."}));
}
export function prepareAccount(a) {
  return {...structuredClone(a), sources:a.sources.filter(s=>s.verified), stage:"Matched",contact:null, incumbent:incumbentMap[a.id]||incumbentMap[a.domain?.split(".")[0]]||null, route:"Direct", visited:["Matched"]};
}
export function initialState(seed, reference = true) {
  const icp = inferProfile(defaultProduct); icp.approved = reference;
  return {version:1,revision:0,asOf:seedDate, product:{...defaultProduct}, icp, accounts:reference?seed.map(prepareAccount):[],
    cases:{}, messages:{}, reviewedCases:{}, labels:{}, activity:[], usage:[], credits:10, outbox:[], graphResults:{}, suggestions:[],
    mode:"rehearsal", demoInbox:"team@example.test"};
}
export function inputsFor(s,id) {return s.cases[id] || initialInputs(s.product.name.toLowerCase()==="flexprice");}
export function moneySummary(s,id) {return businessCase(inputsFor(s,id));}
export function featureSource(a) {return [...a.sources].filter(x=>x.verified).sort((x,y)=>(y.published||"").localeCompare(x.published||""))[0];}
export const activityLabels = {graph_query:"Graph query",lead_enriched:"Contact lookup",business_case_generated:"Business case",outreach_sent:"Approved dispatch"};
export function logActivity(s,actor,title,details="",id=null,when=new Date().toISOString()) {
  s.activity.unshift({actor,title,details,account:id,at:when}); s.activity=s.activity.slice(0,240);
}
export function charge(s,kind,id,job,when) {
  const cost=rates[kind]; if(!cost) throw Error("Unknown billable action.");
  if(s.usage.some(e=>e.id===job))return;
  if(s.credits<cost)throw Error("Insufficient credits. This action needs "+cost+"; the available balance is "+s.credits+".");
  s.credits-=cost;
  s.usage.unshift({id:job,kind,cost,account:id,agent:roleFor[kind],at:when,mode:s.mode});
}
const addr=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
export function messageValid(m) {
  return addr.test(m.recipient) && !/[\r\n]/.test(m.recipient+m.subject) && m.subject.trim().length>0 && m.body.trim().length>0;
}
export async function signature(m) {
  const raw=new TextEncoder().encode(JSON.stringify([m.account,m.channel,m.recipient,m.subject,m.body]));
  const digest=await crypto.subtle.digest("SHA-256",raw);
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
export function draftFor(s,a,channel="Email") {
  const src=featureSource(a);
  if(!src)throw Error("A checked source is required before preparing outreach.");
  const result=moneySummary(s,a.id);
  let body="Hi there,\n\nI read "+a.name+"'s “"+src.title+"”. "+s.product.name+" helps with "+(s.product.capabilities.split("\n")[0]||"this workflow").toLowerCase()+".";
  if(a.route==="Warm introduction") body="Hi there,\n\nWould you be comfortable introducing me to the person responsible for "+(s.product.name==="Flexprice"?"billing":s.product.capabilities.split("\n")[0].toLowerCase())+" at "+a.name+"? I saw their “"+src.title+"”.";
  if(a.route==="Replacement discussion")body+=" I also saw the recent public feedback on your current provider. Would a comparison of migration costs be helpful?";
  if(s.reviewedCases[a.id] && result.complete && result.net>0)body+=" Under the build assumptions we modeled, the estimated year-one economic advantage would be "+dollars(result.net)+", including engineering capacity.";
  body+="\n\nWould it be useful to compare those assumptions with your current process?";
  if(channel==="LinkedIn")body="I read "+a.name+"'s “"+src.title+"”. Would you be open to comparing how your team handles "+s.product.capabilities.split("\n")[0].toLowerCase()+"?";
  return {account:a.id,channel,recipient:channel==="Email"?s.demoInbox:"Manual LinkedIn draft",subject:(s.product.name==="Flexprice"?"A billing question for ":"A question for ")+a.name,body,status:"Pending",approval:null,sourceIds:[src.id],variant:a.route,
    reviewer:"Reviewed against the saved source and the current business case."};
}
export function precision(s) {
  const total=Object.keys(s.labels).length;
  const top=orderedAccounts(s).slice(0,5);
  if(total<20 || top.length<5 || top.some(a=>typeof s.labels[a.name]!=="boolean"))return {total,score:null};
  return {total,score:top.filter(a=>s.labels[a.name]).length/5};
}
const clip=(v,n=2000)=>String(v??"").trim().slice(0,n);
function requireProfile(s) {if(!s.icp.approved)throw Error("Review and approve the customer profile before running discovery.");}
function requireAccount(s,id) {const a=s.accounts.find(x=>x.id===id);if(!a)throw Error("This account is outside the active campaign.");return a;}
export function checkSource(a) {
  return (a.sources||[]).filter(e=>e.verified && /^https:\/\//.test(e.url) && e.quote && e.id);
}
export async function applyAction(previous, action, env={}) {
  const s=structuredClone(previous);
  const {kind, id}=action, p=action.payload||{};
  const when=env.now||new Date().toISOString(), job=env.job||crypto.randomUUID();
  const log=(who,title,details="")=>logActivity(s,who,title,details,id,when);
  const human="Human"; const acct=()=>requireAccount(s,id);
  const bill=(type)=>charge(s,type,id,job,when);
  const msg=()=>{const m=s.messages[id];if(!m)throw Error("Prepare the draft first.");return m;};
  switch(kind){
    case "product": {
      const product=Object.fromEntries(Object.keys(defaultProduct).map(k=>[k,clip(p[k])]));
      if(!product.name || !product.description || !product.capabilities)throw Error("Enter a product name, description, and at least one capability.");
      s.product=product;s.icp=env.icp||inferProfile(product);s.icp.approved=false;
      s.accounts=[];s.cases={};s.messages={};s.reviewedCases={};s.graphResults={};s.labels={};s.suggestions=[];
      log(human,"Product brief saved",product.name);break;
    }
    case "profile": {
      const prior=JSON.stringify([s.icp.fields,s.icp.expansions]);
      for(const [key,field] of Object.entries(s.icp.fields)){
        const edit=p.fields?.[key];
        if(edit){field.value=clip(edit.value);field.enabled=edit.enabled!==false;}
      }
      if(!Object.values(s.icp.fields).some(f=>f.enabled&&f.value.trim()))throw Error("Include at least one target field.");
      s.icp.expansions.forEach((e,i)=>{if(["Accepted","Dismissed","Suggested"].includes(p.expansions?.[i]))e.status=p.expansions[i];});
      s.icp.approved=!!p.approved;
      if(s.accounts.length && prior!==JSON.stringify([s.icp.fields,s.icp.expansions])){s.accounts=[];s.messages={};s.cases={};s.reviewedCases={};s.graphResults={};s.labels={};}
      log(human,s.icp.approved?"Customer profile approved":"Profile saved for review");break;
    }
    case "discover": {
      requireProfile(s);
      let records=env.prospects||[];
      if(!env.liveDiscovery){
        const match=records.map(prepareAccount);
        records=orderedAccounts({...s,accounts:match}).filter(a=>a.scoring.fit>0);
      }
      const old=Object.fromEntries(s.accounts.map(a=>[a.id,a]));
      s.accounts=records.map(a=>({...prepareAccount(a),...(old[a.id]?{stage:old[a.id].stage,visited:old[a.id].visited,contact:old[a.id].contact,route:old[a.id].route}:{}),sources:checkSource(a)}));
      s.asOf=env.liveDiscovery?when.slice(0,10):seedDate;
      log("Planner","Target criteria compiled",s.icp.fields.segments.value);
      log("Researcher",env.liveDiscovery?"Public sources checked":"Evidence snapshot loaded",s.accounts.length+" accounts retained");
      log("Reviewer","Evidence filter applied",s.accounts.reduce((n,a)=>n+a.sources.length,0)+" matching excerpts available");
      break;
    }
    case "case": {
      const a=acct();const inputs=inputsFor(s,id);
      for(const [k,spec] of Object.entries(financeFields)){
        if(!(k in (p.inputs||{})))continue;
        const entry=p.inputs[k]; const value=entry?.value;
        if(value!==null && (value===""||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>spec.max))throw Error("Check "+spec.label.toLowerCase()+".");
        if(value===inputs[k].value && entry.origin===inputs[k].origin)continue;
        inputs[k]={value:value===null?null:Number(value),origin:value===null?"Unknown":entry.origin==="Assumed"?"Assumed":"User provided",source:null};
      }
      if(!businessCase(inputs).complete && p.approve)throw Error("Fill the unknown inputs before approving the model.");
      if(p.approve)bill("business_case_generated");
      s.cases[id]=inputs;s.reviewedCases[id]=!!p.approve;
      const draft=s.messages[id];if(draft && draft.status!=="Dispatched"){delete s.messages[id];}
      log(p.approve?human:"Financial analyst",p.approve?"Business case approved":"Assumptions saved",a.name);break;
    }
    case "graph": {
      const a=acct(); if(!["warm","displacement"].includes(p.name))throw Error("Unknown graph query.");
      bill("graph_query");const match=env.graphMatches ? env.graphMatches.find(m=>m.id===id) : relationship(s,a,p.name);
      const result=match?.reason || (p.name==="warm"?"No verified employment path to a reference customer.":"No verified recent dissatisfaction with a documented incumbent.");
      s.graphResults[id+":"+p.name]={result,matched:!!match,at:when};
      if(match)a.route=p.name==="warm"?"Warm introduction":"Replacement discussion";
      log("Researcher",p.name==="warm"?"Warm path checked":"Incumbent checked",result);break;
    }
    case "enrich": {
      const a=acct();bill("lead_enriched");a.contact=env.contact||{email:null,status:"Uncertain",role:a.persona,source:"Reference research"};
      log("Researcher","Contact lookup completed",a.contact.email?a.contact.status:"No verified address on file");break;
    }
    case "draft": {
      const a=acct();if(!s.reviewedCases[id])throw Error("Approve the financial assumptions before drafting.");
      if(s.messages[id]?.status==="Dispatched")throw Error("This outreach has already been dispatched.");
      const channel=p.channel==="LinkedIn"?"LinkedIn":"Email";
      s.messages[id]=draftFor(s,a,channel);
      if(env.reviewedCopy){s.messages[id].subject=env.reviewedCopy.subject;s.messages[id].body=env.reviewedCopy.body;}
      log("Writer","Outreach drafted",channel);
      if(!s.reviewedCases[id] || !checkSource(a).length)throw Error("Reviewer requires a source and approved financial assumptions.");
      if(!env.reviewedCopy && !a.sources.some(x=>x.kind==="dissatisfaction")){
        log("Reviewer","Buying intent claim withheld","The sources support a reason to talk, but do not establish a plan to switch.");
        log("Writer","Conditional outreach prepared","The draft asks the buyer to validate the assumptions.");
      }
      log("Reviewer","Draft ready for human review");break;
    }
    case "edit": {
      const m=msg();if(m.status==="Dispatched")throw Error("Sent messages are immutable.");
      const next={recipient:String(p.recipient??m.recipient).slice(0,320),subject:String(p.subject??m.subject).slice(0,300),body:String(p.body??m.body).slice(0,7000)};
      if(Object.keys(next).some(k=>m[k]!==next[k])){Object.assign(m,next,{status:"Pending",approval:null});log(human,"Draft edited","Fresh approval required");}break;
    }
    case "approve": {
      const m=msg();if(m.status==="Dispatched")throw Error("Already dispatched.");
      if(m.channel!=="Email"||!messageValid(m))throw Error("An email needs a valid recipient, subject, and message.");
      if(m.recipient!==s.demoInbox)throw Error("Use the configured team test inbox for this demo.");
      m.approval={hash:await signature(m),by:"Workspace owner",at:when};m.status="Approved";log(human,"Exact message approved");break;
    }
    case "reject": {
      const m=msg();if(m.status==="Dispatched")throw Error("Already dispatched.");
      m.approval=null;m.status="Rejected";log(human,"Outreach rejected");break;
    }
    case "send": {
      const a=acct(),m=msg();if(m.channel!=="Email"||m.status!=="Approved"||m.approval?.hash!==await signature(m)||m.recipient!==s.demoInbox)throw Error("A matching human approval for the current test recipient and message is required.");
      bill("outreach_sent");m.status="Dispatched";m.dispatchedAt=when;
      const method=env.gmail?"Gmail test":"Local test outbox";
      s.outbox.unshift({account:id,hash:m.approval.hash,recipient:m.recipient,at:when,method,by:m.approval.by});
      if(a.stage==="Matched"){a.stage="Contacted";a.visited=[...new Set([...a.visited,a.stage])];}
      log(human,env.gmail?"Team test email dispatched":"Test dispatch recorded",method);break;
    }
    case "stage": {
      const a=acct();if(!stageNames.includes(p.stage))throw Error("Unknown stage.");
      a.stage=p.stage;a.visited=[...new Set([...a.visited,p.stage])];
      log(human,"Stage set to "+p.stage,"Manual outcome");if(p.stage==="Closed lost")s.suggestions.unshift("Review the target profile after losing "+a.name+".");break;
    }
    case "label": {
      if(!evaluationPool.includes(p.name)&&!s.accounts.some(a=>a.name===p.name))throw Error("Unknown evaluation company.");
      if(typeof p.fit!=="boolean")delete s.labels[p.name];else s.labels[p.name]=p.fit;
      break;
    }
    case "reset": {if(s.mode==="live")throw Error("Reset is available in the rehearsal workspace.");const fresh=initialState(env.seed||[]);fresh.revision=s.revision+1;return fresh;}
    default:throw Error("Unsupported workspace operation.");
  }
  s.revision++;
  return s;
}
