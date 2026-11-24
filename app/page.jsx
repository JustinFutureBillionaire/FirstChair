"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {Activity,Check,X} from "lucide-react";
import seed from "../data/prospects.json";
import {applyAction,initialState} from "../lib/workspace.mjs";
import {orderedAccounts} from "../lib/scoring.mjs";
import {Mark,Modal} from "../components/ui";
import {Product,Customer,Prospects} from "../components/research";
import {Account} from "../components/account";
import {Outreach,Results,Usage} from "../components/operations";
const localKey="first-chair.workspace.v1";
const working={product:"Claude is reading your product and drafting the customer profile",profile:"Saving the profile",discover:"Searching the web, reading company pages and checking every quote",case:"Checking credits and approving the numbers",draft:"Planner, Researcher, Analyst, Writer and Reviewer are working on the email",enrich:"Looking up and verifying the email address",graph:"Checking relationship paths",send:"Sending the approved email"};
const pages=["product","customer","prospects","account","outreach","results","usage"];
function route(){const value=location.hash.slice(1).split("/").map(s=>{try{return decodeURIComponent(s);}catch{return s;}});return {page:pages.includes(value[0])?value[0]:"product",id:value[1]||null,tab:value[2]||null};}
export default function Home(){
 const [s,setS]=useState(()=>initialState(seed)), current=useRef(s);current.current=s;
 const [view,setView]=useState({page:"product",id:null,tab:null}),[ready,setReady]=useState(false),[busy,setBusy]=useState(false);
 const [toast,setToast]=useState(null),[dialog,setDialog]=useState("");
 const [providers,setProviders]=useState({}),api=useRef(null), pending=useRef(false);
 const [connectToken,setConnectToken]=useState(""), [liveToken,setLiveToken]=useState("");
 const notify=useCallback((message,error=false)=>setToast({message,error,at:Date.now()}),[]);
 useEffect(()=>{if(!toast)return;const delay=setTimeout(()=>setToast(null),toast.error?9000:4200);return ()=>clearTimeout(delay);},[toast]);
 useEffect(()=>{
   let alive=true;setView(route());
   const sync=()=>{setView(route());setDialog("");window.scrollTo(0,0);};window.addEventListener("hashchange",sync);
   (async()=>{
     let local;try{const saved=JSON.parse(localStorage.getItem(localKey));if(saved?.version===1&&saved.product&&saved.icp&&Array.isArray(saved.accounts))local=saved;}catch{}
     let root=process.env.NEXT_PUBLIC_API_URL||"";
     const secret=liveToken||localStorage.getItem("fc.operator")||"";
     try{
       const resp=await fetch(root+"/api/status",{signal:AbortSignal.timeout(2500)});
       if(resp.ok && resp.headers.get("content-type")?.includes("application/json")){
         const status=await resp.json();if(alive)setProviders(status);
         if(status.service==="first-chair" && status.requiresToken && !secret && alive)setDialog("connect");
         if(status.service==="first-chair" && (!status.requiresToken || secret)){
           const a=await fetch(root+"/api/workspace",{headers:secret?{"X-Workspace-Token":secret}:{}});
           if(a.ok){const data=await a.json();if(alive){api.current={root,secret};current.current=data;setS(data);setReady(true);}return;}
           if(secret&&alive){notify("The workspace token was not accepted.",true);localStorage.removeItem("fc.operator");setDialog("connect");}
         }
       }
     }catch{}
     if(alive){api.current=null;current.current=local||initialState(seed);setS(current.current);setReady(true);}
   })();
   return ()=>{alive=false;window.removeEventListener("hashchange",sync);};
 },[liveToken,notify]);
 function go(page,id=null,tab=null){const hash=[page,id,tab].filter(Boolean).map(encodeURIComponent).join("/");setDialog("");if(location.hash!=="#"+hash)location.hash=hash;else setView(route());}
 async function act(kind,id,payload={},success){
   if(!ready||pending.current)return false;pending.current=true;setBusy(kind);
   try{let data;
     if(api.current){
       const {root,secret}=api.current;const response=await fetch(root+"/api/actions",{method:"POST",headers:{"Content-Type":"application/json",...(secret?{"X-Workspace-Token":secret}:{})},body:JSON.stringify({kind,id,payload,revision:current.current.revision,operation_id:crypto.randomUUID()})});
       const body=await response.json();if(!response.ok){
         if(response.status===409){const fresh=await fetch(root+"/api/workspace",{headers:secret?{"X-Workspace-Token":secret}:{}});if(fresh.ok){const latest=await fresh.json();current.current=latest;setS(latest);}}
         throw Error(typeof body.detail==="string"?body.detail:"The operation could not be completed.");
       }
       if(response.status===202 && body.job){
         const deadline=Date.now()+180000;
         while(Date.now()<deadline){
           await new Promise(done=>setTimeout(done,1200));
           const next=await fetch(root+"/api/jobs/"+encodeURIComponent(body.job),{headers:secret?{"X-Workspace-Token":secret}:{}});
           if(!next.ok)throw Error("Could not read the agent run.");
           const job=await next.json();if(job.status==="failed")throw Error(job.error);
           if(job.status==="complete"){data=job.workspace;break;}
         }
         if(!data)throw Error("The agents are still working. Reopen this page in a minute.");
       }else data=body;
     }else{
       const saved=localStorage.getItem(localKey);const latest=saved?JSON.parse(saved):null;
       if(latest?.revision>current.current.revision){current.current=latest;setS(latest);throw Error("Another tab changed this workspace. Review the update and retry.");}
       data=await applyAction(current.current,{kind,id,payload},{prospects:seed,seed,job:crypto.randomUUID()});localStorage.setItem(localKey,JSON.stringify(data));
     }
     current.current=data;setS(data);if(success)notify(success);return true;
   }catch(e){notify(e.message||"Please try again.",true);return false;}finally{pending.current=false;setBusy(false);}
 }
 const ranked=orderedAccounts(s),selected=s.accounts.find(a=>a.id===view.id);
 const sent=Object.values(s.messages).some(m=>m.status==="Dispatched");
 const steps=[
  {key:"product",label:"Product",done:s.icp.approved||s.accounts.length>0},
  {key:"customer",label:"Ideal customer",done:s.icp.approved},
  {key:"prospects",label:"Prospects",done:s.accounts.length>0,open:s.icp.approved},
  {key:"outreach",label:"Outreach",done:sent,open:s.accounts.length>0},
  {key:"results",label:"Results",done:false,open:s.accounts.length>0},
 ];
 const here={account:"prospects"}[view.page]||view.page, at=steps.findIndex(x=>x.key===here);
 const stateProps={s,act,go,notify,busy,ready,ranked,selected,view,providers};
 return <div className="app">
 <header className="bar"><button className="brand" onClick={()=>go("product")}><Mark/><span>First Chair</span></button>
  <nav className="stepper" aria-label="Steps" style={{"--at":Math.max(0,at)}}>{steps.map((x,i)=><button key={x.key} disabled={x.open===false} aria-current={i===at?"step":undefined} className={(i===at?"here ":"")+(x.done?"done":"")} onClick={()=>go(x.key)}><span className="dot">{x.done&&i!==at?<Check size={11} strokeWidth={3}/>:i+1}</span><span className="label">{x.label}</span></button>)}<span className="track" aria-hidden="true"><i/></span></nav>
  <button className={"credits"+(view.page==="usage"?" here":"")} onClick={()=>go("usage")} aria-label={s.credits+" credits left. Open usage."}><b key={s.credits}>{s.credits}</b> credits</button></header>
 <main id="main" className="main" key={view.page+":"+(view.id||"")}>
 {view.page==="product"&&<Product {...stateProps}/>}
 {view.page==="customer"&&<Customer {...stateProps}/>}
 {view.page==="prospects"&&<Prospects {...stateProps}/>}
 {view.page==="account"&&(selected?<Account {...stateProps}/>:<Prospects {...stateProps}/>)}
 {view.page==="outreach"&&<Outreach {...stateProps}/>}
 {view.page==="results"&&<Results {...stateProps}/>}
 {view.page==="usage"&&<Usage {...stateProps} openConnect={()=>setDialog("connect")}/>}
 </main>
 {busy&&<div className="busy" aria-hidden="true"/>}
 {busy&&working[busy]&&<div className="working" role="status"><span className="spin-dot"/>{working[busy]}</div>}
 {toast&&<div className={"toast"+(toast.error?" error":"")} role={toast.error?"alert":"status"}>{toast.error?<Activity size={15}/>:<Check size={15}/>}<span>{toast.message}</span><button aria-label="Dismiss" onClick={()=>setToast(null)}><X size={14}/></button></div>}
 {dialog==="connect"&&<Modal title="Connect the live workspace" close={()=>setDialog("")}><form className="stack" onSubmit={e=>{e.preventDefault();localStorage.setItem("fc.operator",connectToken);setLiveToken(connectToken);setConnectToken("");setDialog("");}}><label className="field">Operator token<input type="password" data-focus required autoComplete="off" value={connectToken} onChange={e=>setConnectToken(e.target.value)}/></label><button className="btn primary">Connect</button></form></Modal>}
 </div>;
}
