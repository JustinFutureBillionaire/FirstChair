"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {Activity, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown, ChevronRight, CircleDollarSign, Columns3, CreditCard, FileCheck2, FolderSearch, LayoutDashboard, Menu, Search, SlidersHorizontal, Target, X} from "lucide-react";
import seed from "../data/prospects.json";
import {applyAction,initialState} from "../lib/workspace.mjs";
import {orderedAccounts} from "../lib/scoring.mjs";
import { Mark, Modal } from "../components/ui";
import { Overview, Prospects } from "../components/research";
import { Account, CasePage } from "../components/account";
import { Campaign, Credits, Pipeline, Queue } from "../components/operations";
import { JudgeDemo } from "../components/demo";
const nav=[
 {key:"overview",label:"Opportunity desk",icon:LayoutDashboard,group:"Workspace"},
 {key:"profile",label:"Target profile",icon:Target},
 {key:"prospects",label:"Prospects",icon:FolderSearch},
 {key:"cases",label:"Business cases",icon:CircleDollarSign},
 {key:"outreach",label:"Outreach review",icon:FileCheck2,group:"Operations"},
 {key:"pipeline",label:"Pipeline",icon:Columns3},
 {key:"credits",label:"Usage & connections",icon:SlidersHorizontal},
 {key:"demo",label:"Judge walkthrough",icon:BookOpen},
];
const localKey="first-chair.workspace.v1";
function route(){const value=location.hash.slice(1).split("/").map(s=>{try{return decodeURIComponent(s);}catch{return s;}});return {page:[...nav.map(n=>n.key),"account"].includes(value[0])?value[0]:"overview",id:value[1]||null,tab:value[2]||null};}
export default function Home(){
 const [s,setS]=useState(()=>initialState(seed)), current=useRef(s);current.current=s;
 const [view,setView]=useState({page:"overview",id:null,tab:null}),[ready,setReady]=useState(false),[busy,setBusy]=useState(false);
 const [toast,setToast]=useState(null),[menu,setMenu]=useState(false),[dialog,setDialog]=useState(""),[q,setQ]=useState("");
 const [providers,setProviders]=useState({}),api=useRef(null), pending=useRef(false);
 const [connectToken,setConnectToken]=useState(""), [liveToken,setLiveToken]=useState("");
 const notify=useCallback((message,error=false)=>setToast({message,error,at:Date.now()}),[]);
 useEffect(()=>{if(!toast)return;const delay=setTimeout(()=>setToast(null),toast.error?9000:4200);return ()=>clearTimeout(delay);},[toast]);
 useEffect(()=>{
   let alive=true;setView(route());
   const sync=()=>{setView(route());setMenu(false);setDialog("");window.scrollTo(0,0);};window.addEventListener("hashchange",sync);
   const shortcut=e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setQ("");setDialog(d=>d==="search"?"":"search");}if(e.key==="Escape")setMenu(false);};document.addEventListener("keydown",shortcut);
   (async()=>{
     let local;try{const saved=JSON.parse(localStorage.getItem(localKey));if(saved?.version===1&&saved.product&&saved.icp&&Array.isArray(saved.accounts))local=saved;}catch{}
     let root=process.env.NEXT_PUBLIC_API_URL||"";
     const secret=liveToken||sessionStorage.getItem("fc.operator")||"";
     try{
       const resp=await fetch(root+"/api/status",{signal:AbortSignal.timeout(2500)});
       if(resp.ok && resp.headers.get("content-type")?.includes("application/json")){
         const status=await resp.json();if(alive)setProviders(status);
         if(status.service==="first-chair" && (!status.requiresToken || secret)){
           const a=await fetch(root+"/api/workspace",{headers:secret?{"X-Workspace-Token":secret}:{}});
           if(a.ok){const data=await a.json();if(alive){api.current={root,secret};current.current=data;setS(data);setReady(true);}return;}
           if(secret&&alive)notify("The workspace token was not accepted.",true);
         }
       }
     }catch{}
     if(alive){api.current=null;current.current=local||initialState(seed);setS(current.current);setReady(true);}
   })();
   return ()=>{alive=false;window.removeEventListener("hashchange",sync);document.removeEventListener("keydown",shortcut);};
 },[liveToken,notify]);
 function go(page,id=null,tab=null){const hash=[page,id,tab].filter(Boolean).map(encodeURIComponent).join("/");setMenu(false);setDialog("");if(location.hash!=="#"+hash)location.hash=hash;else setView(route());}
 async function act(kind,id,payload={},success){
   if(!ready||pending.current)return false;pending.current=true;setBusy(true);
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
           if(!next.ok)throw Error("Could not read the Band job.");
           const job=await next.json();if(job.status==="failed")throw Error(job.error);
           if(job.status==="complete"){data=job.workspace;break;}
         }
         if(!data)throw Error("The Band job is still running. Reopen the workspace after the workers finish.");
       }else data=body;
     }else{
       const saved=localStorage.getItem(localKey);const latest=saved?JSON.parse(saved):null;
       if(latest?.revision>current.current.revision){current.current=latest;setS(latest);throw Error("Another tab changed this workspace. Review the update and retry.");}
       data=await applyAction(current.current,{kind,id,payload},{prospects:seed,seed,job:crypto.randomUUID()});localStorage.setItem(localKey,JSON.stringify(data));
     }
     current.current=data;setS(data);if(success)notify(success);return true;
   }catch(e){notify(e.message||"Please try again.",true);return false;}finally{pending.current=false;setBusy(false);}
 }
 const ranked=orderedAccounts(s),selected=s.accounts.find(a=>a.id===view.id); const navItem=nav.find(i=>i.key===view.page);
 const label=view.page==="account"?(selected?.name||"Account"):navItem?.label||"Opportunity desk";
 const stateProps={s,act,go,notify,busy,ready,ranked,selected,view,providers};
 const queueCount=Object.values(s.messages).filter(m=>["Pending","Approved"].includes(m.status)).length;
 const searchResults=[...nav.map(n=>({label:n.label,note:"Workspace",click:()=>go(n.key)})),...ranked.map(a=>({label:a.name,note:a.segment,click:()=>go("account",a.id)}))]
   .filter(item=>(item.label+" "+item.note).toLowerCase().includes(q.trim().toLowerCase()));
 return <div className="shell"><a href="#main-content" className="skip" onClick={e=>{e.preventDefault();document.getElementById("main-content")?.focus();}}>Skip to content</a>
 {menu&&<button className="mobile-shade" aria-label="Close navigation" onClick={()=>setMenu(false)}/>}
 <aside className={"sidebar "+(menu?"open":"")}><button className="brand" onClick={()=>go("overview")}><Mark light/><span>First Chair</span></button>
 <button className="workspace-picker" onClick={()=>go("profile")}><span className="product-icon">{s.product.name.slice(0,1)}</span><span><small>Active campaign</small><strong>{s.product.name}</strong></span><ChevronDown size={14}/></button>
 <nav aria-label="Main navigation">{nav.map(n=><div key={n.key}>{n.group&&<div className="nav-group">{n.group}</div>}<button aria-current={(view.page===n.key||view.page==="account"&&n.key==="prospects")?"page":undefined} className={"nav-item "+((view.page===n.key||view.page==="account"&&n.key==="prospects")?"active":"")} onClick={()=>go(n.key)}><n.icon size={17}/>{n.label}{n.key==="outreach"&&queueCount>0&&<b>{queueCount}</b>}</button></div>)}</nav>
 <div className="sidebar-foot"><button className="usage-mini" onClick={()=>go("credits")}><span><i/>{s.mode==="live"?"Connected workspace":"Demo workspace"}</span><ArrowUpRight size={14}/></button><div className="foot-brand"><span className="mini-logo"><Mark light/></span><span>First Chair<small>Research workspace</small></span></div></div></aside>
 <div className="surface"><header className="topbar"><div className="crumb"><button className="mobile-menu icon-button" onClick={()=>setMenu(true)} aria-label="Open navigation"><Menu size={20}/></button><span>Workspace</span><ChevronRight size={13}/><strong>{label}</strong></div>
 <div className="top-actions"><button className="search-top" onClick={()=>{setQ("");setDialog("search");}}><Search size={15}/><span>Search workspace</span><kbd>⌘ K</kbd></button><button className="credit-button" onClick={()=>go("credits")} aria-label={"View usage, "+s.credits+" credits"}><CreditCard size={15}/><b>{s.credits}</b><span>credits</span></button></div></header>
 <main id="main-content" tabIndex={-1} key={view.page+":"+(view.id||"")} className="main">
 {view.page==="overview"&&<Overview {...stateProps}/>}
 {view.page==="prospects"&&<Prospects {...stateProps}/>}
 {view.page==="profile"&&<Campaign {...stateProps}/>}
 {view.page==="account"&&(selected?<Account {...stateProps}/>:<Prospects {...stateProps}/>)}
 {view.page==="cases"&&<CasePage {...stateProps}/>}
 {view.page==="outreach"&&<Queue {...stateProps}/>}
 {view.page==="pipeline"&&<Pipeline {...stateProps}/>}
 {view.page==="credits"&&<Credits {...stateProps} openConnect={()=>setDialog("connect")}/>}
 {view.page==="demo"&&<JudgeDemo key={view.id||"walkthrough"} {...stateProps} showBenchmark={view.id==="benchmark"}/>}
 </main></div>
 {busy&&<div className="work-progress" role="status">Updating workspace…</div>}
 {toast&&<div className={"toast "+(toast.error?"error":"")} role={toast.error?"alert":"status"}>{toast.error?<Activity size={16}/>:<Check size={16}/>}<span>{toast.message}</span><button aria-label="Dismiss notification" onClick={()=>setToast(null)}><X size={14}/></button></div>}
 {dialog==="search"&&<Modal title="Search workspace" close={()=>setDialog("")}><input className="search-field" aria-label="Search pages and companies" data-focus placeholder="Find a company or a workspace page…" value={q} onChange={e=>setQ(e.target.value)}/><div className="search-results">{searchResults.map(x=><button onClick={x.click} key={x.label}><span>{x.label}<small>{x.note}</small></span><ArrowRight size={15}/></button>)}{searchResults.length===0&&<p>No matches for “{q}”.</p>}</div></Modal>}
 {dialog==="connect"&&<Modal title="Connect operator workspace" close={()=>setDialog("")}><form onSubmit={e=>{e.preventDefault();sessionStorage.setItem("fc.operator",connectToken);setLiveToken(connectToken);setConnectToken("");setDialog("");}}><label>Workspace access token<input type="password" data-focus required autoComplete="off" value={connectToken} onChange={e=>setConnectToken(e.target.value)}/></label><button className="btn primary">Connect workspace</button></form></Modal>}
 </div>;
}
