"use client";
import { ArrowUpRight, Check, ChevronRight, CircleHelp, ExternalLink, FileText, Minus, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { signalLabels } from "../lib/scoring.mjs";
export const asset = name => (process.env.NEXT_PUBLIC_BASE_PATH || "")+"/"+name;
export function Mark({light=false}){return <img width="30" height="30" alt="" className="mark" src={asset("first-chair-mark-"+(light?"light":"dark")+".png")}/>;}
export function Company({a,large=false}) {return <span className={"company-mark "+(large?"large":"")} style={{"--co":a.color||"#446c65"}} aria-hidden="true">{a.initial||a.name[0]}</span>;}
export function Chip({children,tone="quiet",dot=false}){return <span className={"chip "+tone}>{dot&&<i/>}{children}</span>;}
export function Tier({value}){return <Chip tone={value==="A"?"green":value==="B"?"sand":"quiet"} dot>Tier {value}</Chip>;}
export function SectionHead({title,aside,children}){return <div className="section-title"><div><h2>{title}</h2>{aside&&<p>{aside}</p>}</div>{children}</div>;}
export function PageHead({title,sub,children}){return <header className="page-head"><div><h1>{title}</h1>{sub&&<p>{sub}</p>}</div>{children&&<div className="actions">{children}</div>}</header>;}
export function Empty({title,children,icon:Icon=FileText}){return <div className="empty"><Icon size={24} strokeWidth={1.5}/><h3>{title}</h3>{children&&<p>{children}</p>}</div>;}
export function DateText({value,long=false}){if(!value)return <>Date unavailable</>;return new Date(value).toLocaleDateString("en-US",{month:long?"long":"short",day:"numeric",year:long?"numeric":undefined,timeZone:"UTC"});}
export function Proof({source,small=false}){
  return <article className={"proof "+(small?"compact":"")}><div className="proof-top"><span className="eyebrow">{signalLabels[source.kind]||"Source"}</span><span><DateText value={source.published||source.checked}/>{!source.published&&" · checked"}</span></div><h3>{source.title}</h3><blockquote>“{source.quote}”</blockquote>{!small&&<p>{source.note}</p>}<a className="source-link" href={source.url} target="_blank" rel="noreferrer"><ShieldCheck size={14}/> {new URL(source.url).hostname.replace(/^www\./,"")} <ArrowUpRight size={13}/></a></article>;
}
export function Modal({title,children,close,wide=false}){
  const ref=useRef(null);
  const closeRef=useRef(close); closeRef.current=close;
  useEffect(()=>{const prev=document.activeElement;const box=ref.current;
    const target=box.querySelector("[data-focus]")||box;target.focus();const old=document.body.style.overflow;document.body.style.overflow="hidden";
    function key(e){if(e.key==="Escape")closeRef.current();if(e.key!=="Tab")return;const nodes=[...box.querySelectorAll("a,button,input,select,textarea,[tabindex='0']")].filter(el=>!el.disabled);if(!nodes.length)return;
      if(e.shiftKey&&(document.activeElement===nodes[0]||document.activeElement===box)){e.preventDefault();nodes.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0].focus();}}
    document.addEventListener("keydown",key);return ()=>{document.removeEventListener("keydown",key);document.body.style.overflow=old;prev?.focus?.();};},[]);
  return <div className="scrim" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={"modal "+(wide?"wide":"")}><div className="modal-title"><h2>{title}</h2><button aria-label="Close dialog" className="icon-button" onClick={close}><X size={19}/></button></div>{children}</section></div>;
}
export function SwitchTabs({tabs,value,onChange,label}){return <div className="tabs" aria-label={label}>{tabs.map(t=><button key={t} className={t===value?"active":""} aria-pressed={t===value} onClick={()=>onChange(t)}>{t}</button>)}</div>;}
export function LinkButton({children,onClick}){return <button className="text-button" onClick={onClick}>{children}<ChevronRight size={14}/></button>;}
export function ScoreTrack({score}){return <span className="score-track" aria-label={"Priority "+score}><span><i style={{width:score+"%"}}/></span><b>{score}</b></span>;}
