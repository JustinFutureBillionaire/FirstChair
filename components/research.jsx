"use client";
import {useState} from "react";
import {Activity, ArrowDownUp, ArrowRight, ArrowUpRight, Bookmark, BookOpen, Building2, CalendarDays, CheckCheck, CircleDollarSign, ClipboardCheck, FileCheck2, Filter, Layers3, ListFilter, Network, Radar, RefreshCw, ScanLine, Search, ShieldCheck, Sparkles, Target} from "lucide-react";
import {asset,Chip,Company,DateText,Empty,LinkButton,PageHead,ScoreTrack,SectionHead,Tier} from "./ui";
import {featureSource} from "../lib/workspace.mjs";
import {signalLabels} from "../lib/scoring.mjs";
export function Table({rows,go,compact=false}){
 if(!rows.length)return <Empty title="No matching prospects" icon={FolderIcon}>Adjust the filters or review your target profile and run discovery.</Empty>;
 return <div className="table-scroll"><table className={"prospect-table "+(compact?"compact-table":"")}><thead><tr><th>Company</th>{!compact&&<th>Latest evidence</th>}<th>Priority</th><th>Tier</th>{!compact&&<th>Pipeline</th>}<th><span className="sr">Open account</span></th></tr></thead><tbody>{rows.map(a=><tr key={a.id} onClick={()=>go("account",a.id)}><td><button className="account-name" onClick={e=>{e.stopPropagation();go("account",a.id);}}><Company a={a}/><span><strong>{a.name}</strong><small>{a.segment}</small></span></button></td>{!compact&&<td><span className="signal-title">{featureSource(a)?.title||"Fit only"}</span></td>}<td><ScoreTrack score={a.scoring.priority}/></td><td><Tier value={a.scoring.tier}/></td>{!compact&&<td>{a.stage}</td>}<td><ArrowUpRight className="row-arrow" size={15}/></td></tr>)}</tbody></table></div>;
}
const FolderIcon=Layers3;
export function Overview({s,go,ranked,act,busy,ready}){
 const top=(s.mode==="rehearsal"&&ranked.find(a=>a.id==="exa"))||ranked[0];
 const signal=top&&featureSource(top);
 const sourceCount=top?.sources.filter(source=>source.verified).length||0;
 const events=ranked.flatMap(a=>a.sources.filter(p=>p.verified&&p.published).map(p=>({p,a}))).sort((x,y)=>y.p.published.localeCompare(x.p.published));
 const open=Object.values(s.messages).filter(m=>m.status==="Pending").length;
 const stats=[[Building2,"Prospects",ranked.length,"prospects"],[ShieldCheck,"Checked sources",ranked.reduce((n,a)=>n+a.sources.filter(source=>source.verified).length,0),"prospects"],[CircleDollarSign,"Approved cases",Object.values(s.reviewedCases).filter(Boolean).length,"cases"],[FileCheck2,"Drafts to review",open,"outreach"]];
 return <>
 <PageHead title="Opportunity desk" sub={"Your research and outreach for "+s.product.name+"."}>{s.mode==="live"?<button className="btn primary" onClick={()=>go("profile")}><Target size={16}/>Review target profile</button>:<button className="btn primary" onClick={()=>go("demo")}><BookOpen size={16}/>Start walkthrough</button>}</PageHead>
 <div className="briefing-card"><div className="brief-copy"><div className="eyebrow feature-label"><i/>Campaign briefing</div>
 <h2>{top?<>A closer look at <em>{top.name}.</em></>:<>Find your next <em>customer.</em></>}</h2>
 <p>{signal?.note||(top?"Review this account’s fit, buyer role, and business case.":"Describe your product and approve the customer profile to start researching prospects.")}</p>
 <div className="brief-actions"><button className="btn dark" onClick={()=>top?go("account",top.id):go("profile")}>{top?"Open account brief":"Set up campaign"}<ArrowRight size={15}/></button>{signal&&<button className="source-count source-shortcut" onClick={()=>go("account",top.id,"Evidence")}><ShieldCheck size={14}/>{sourceCount} checked {sourceCount===1?"source":"sources"}<ArrowUpRight size={12}/></button>}</div></div>
 <div className="chair-plate"><span className="registration tl"/><span className="registration tr"/><span className="registration bl"/><span className="registration br"/><img src={asset("first-chair-engraving.webp")} alt="" fetchPriority="high"/><span className="plate-caption">FIRST CHAIR &nbsp; / &nbsp; FIELD NOTES</span></div></div>
 <div className="stats-strip">{stats.map(([Icon,label,value,target])=><button key={label} onClick={()=>go(target)}><span className="stat-icon"><Icon size={17}/></span><span><small>{label}</small><b>{String(value).padStart(2,"0")}</b></span><ArrowUpRight size={13} className="stat-arrow"/></button>)}</div>
 <div className="desk-grid"><section className="panel"><SectionHead title="Priority accounts" aside="Ranked by fit and dated buying signals."><LinkButton onClick={()=>go("prospects")}>View all</LinkButton></SectionHead><Table rows={ranked.slice(0,5)} compact go={go}/></section>
 <section className="panel feed-panel"><SectionHead title="Signal feed" aside="Recent company announcements."/><div className="feed-list">{events.slice(0,4).map(({a,p})=><button key={p.id} onClick={()=>go("account",a.id,"Evidence")}><span className={"signal-dot "+p.kind}/><span className="feed-item"><small>{a.name}<i/> <DateText value={p.published}/></small><strong>{p.title}</strong><span>{signalLabels[p.kind]}</span></span><ArrowUpRight size={14}/></button>)}{!events.length&&<Empty title="No dated signals yet"/>}</div></section></div></>;
}
export function Prospects({s,act,go,ranked,busy,ready}){
 const [q,setQ]=useState(""),[tier,setTier]=useState("All tiers"),[order,setOrder]=useState("Priority");
 const rows=ranked.filter(a=>(tier==="All tiers"||tier===a.scoring.tier)&&(a.name+" "+a.domain+" "+a.segment).toLowerCase().includes(q.toLowerCase()));
 if(order==="Name")rows.sort((a,b)=>a.name.localeCompare(b.name));if(order==="Recent signal")rows.sort((a,b)=>(featureSource(b)?.published||"").localeCompare(featureSource(a)?.published||""));
 return <><PageHead title="Prospects" sub="Companies that match the approved customer profile."><button className="btn primary" disabled={busy||!ready} onClick={()=>s.icp.approved?act("discover",null,{},"Discovery finished. The ranked accounts are ready."):go("profile")}><Radar size={16}/>{s.icp.approved?"Run discovery":"Review target profile"}</button></PageHead>
 <section className="panel"><SectionHead title="Account research" aside={s.mode==="live"?"Public evidence is checked before it enters the ranking.":"The demo uses a dated snapshot of public sources."}><Chip dot tone={s.icp.approved?"green":"sand"}>{s.icp.approved?"Profile approved":"Review required"}</Chip></SectionHead><div className="toolbar"><div className="searchbox"><Search size={15}/><input aria-label="Search prospects" placeholder="Search companies or segments" value={q} onChange={e=>setQ(e.target.value)}/></div><select aria-label="Filter tier" value={tier} onChange={e=>setTier(e.target.value)}>{["All tiers","A","B","C"].map(v=><option key={v} value={v}>{v.length===1?"Tier "+v:v}</option>)}</select><select aria-label="Sort prospects" value={order} onChange={e=>setOrder(e.target.value)}>{["Priority","Recent signal","Name"].map(v=><option key={v}>{v}</option>)}</select></div>
 <Table rows={rows} go={go}/><div className="table-foot">{rows.length} of {ranked.length} accounts<span>Source snapshot · <DateText value={s.asOf} long/></span></div></section></>;
}
