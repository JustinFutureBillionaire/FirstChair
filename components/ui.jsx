"use client";
import { ArrowUpRight, Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { signalLabels } from "../lib/scoring.mjs";

export const asset = name => (process.env.NEXT_PUBLIC_BASE_PATH || "") + "/" + name;
export const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function Mark({ light = false }) { return <img width="26" height="26" alt="" className="mark" src={asset("first-chair-mark-" + (light ? "light" : "dark") + ".png")} />; }
export function Company({ a, large = false }) { return <span className={"company-mark" + (large ? " large" : "")} style={{ "--co": a.color || "#446c65" }} aria-hidden="true">{a.initial || a.name[0]}</span>; }
export function Chip({ children, tone = "quiet" }) { return <span className={"chip " + tone}>{children}</span>; }
export function Tier({ value }) { return <span className={"tier t" + value} title={"Tier " + value}>{value}</span>; }
export function Empty({ title, children }) { return <div className="empty"><h3>{title}</h3>{children}</div>; }
export function DateText({ value, long = false }) {
  if (!value) return <>undated</>;
  return new Date(value).toLocaleDateString("en-US", { month: long ? "long" : "short", day: "numeric", year: long ? "numeric" : undefined, timeZone: "UTC" });
}

// Counts from the previous value to the new one so a changed number visibly moves.
export function Num({ value, format = v => Math.round(v).toLocaleString("en-US") }) {
  const [shown, setShown] = useState(value), from = useRef(value);
  useEffect(() => {
    if (reduced() || !Number.isFinite(value)) { setShown(value); from.current = value; return; }
    const start = performance.now(), a = from.current, b = value; let raf;
    const tick = t => { const k = Math.min(1, (t - start) / 450), e = 1 - (1 - k) ** 3; setShown(a + (b - a) * e); if (k < 1) raf = requestAnimationFrame(tick); else from.current = b; };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(shown)}</>;
}

// A verified excerpt: the quote is marked like a highlighter on the source page.
export function Quote({ source, delay = 0, compact = false }) {
  return <figure className={"quote" + (compact ? " compact" : "")} style={{ "--d": delay + "ms" }}>
    <div className="quote-meta"><span>{signalLabels[source.kind] || "Source"}</span><span><DateText value={source.published} /></span></div>
    <blockquote><mark>{source.quote}</mark></blockquote>
    {!compact && source.note && <p>{source.note}</p>}
    <figcaption><Check size={13} className="ok" aria-hidden="true" /><span>Found on</span><a href={source.url} target="_blank" rel="noreferrer">{new URL(source.url).hostname.replace(/^www\./, "")}<ArrowUpRight size={12} /></a></figcaption>
  </figure>;
}

export function Modal({ title, children, close }) {
  const ref = useRef(null), closeRef = useRef(close); closeRef.current = close;
  useEffect(() => {
    const prev = document.activeElement, box = ref.current; (box.querySelector("[data-focus]") || box).focus();
    const key = e => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", key); return () => { document.removeEventListener("keydown", key); prev?.focus?.(); };
  }, []);
  return <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="modal"><div className="modal-title"><h2>{title}</h2><button aria-label="Close" className="icon-button" onClick={close}><X size={18} /></button></div>{children}</section></div>;
}
export function Tabs({ tabs, value, onChange, label }) { return <div className="tabs" role="tablist" aria-label={label}>{tabs.map(t => <button key={t} role="tab" aria-selected={t === value} className={t === value ? "active" : ""} onClick={() => onChange(t)}>{t}</button>)}</div>; }
