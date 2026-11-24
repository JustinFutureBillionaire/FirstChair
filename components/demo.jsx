"use client";

import { useState } from "react";
import { ArrowRight, ArrowUpRight, BookOpen, ChartNoAxesCombined, CreditCard, ShieldCheck } from "lucide-react";
import benchmark from "../data/fit-benchmark.json";
import sample from "../data/prospects.json";
import { summarizeBenchmark } from "../lib/benchmark.mjs";
import { applyAction, initialState } from "../lib/workspace.mjs";
import { Chip, DateText, PageHead, SectionHead } from "./ui";

const benchmarkResult = summarizeBenchmark(initialState(sample), benchmark);

export function JudgeDemo({ s, ranked, go, showBenchmark = false }) {
  const [showEvidence, setShowEvidence] = useState(showBenchmark);
  const [creditResult, setCreditResult] = useState("");
  const account = ranked.find(item => item.id === "exa") || ranked[0];
  const hasDraft = account && s.messages[account.id];
  const openAccount = tab => account ? go("account", account.id, tab) : go("prospects");
  async function checkCreditLimit() {
    const example = initialState(sample);
    example.credits = 0;
    try {
      await applyAction(example, { kind: "enrich", id: "exa" });
      setCreditResult("The rehearsal unexpectedly allowed the lookup.");
    } catch (error) {
      setCreditResult(error.message);
    }
  }
  const steps = [
    {
      title: "Find the reason to call",
      description: "Open the original source behind an account’s pricing signal. See the exact quote and when it was checked.",
      action: "Open account evidence",
      icon: BookOpen,
      open: () => openAccount("Evidence"),
    },
    {
      title: "Test the economics",
      description: "In Base, choose Edit assumptions and move build effort from four months to two. Compare economic advantage with cash impact.",
      action: "Open business case",
      icon: ChartNoAxesCombined,
      open: () => openAccount("Business case"),
    },
    {
      title: "Prove the approval lock",
      description: "Approve the case, prepare outreach, and approve the exact draft. Edit one character to see dispatch lock until the new wording is approved.",
      action: hasDraft ? "Open outreach review" : "Prepare from the business case",
      icon: ShieldCheck,
      open: () => hasDraft ? go("outreach", account.id) : openAccount("Business case"),
    },
    {
      title: "Follow the outcome",
      description: "After a test dispatch, check the new pipeline stage, usage event, and reviewer activity. The rehearsal uses a local outbox.",
      action: "Open usage ledger",
      icon: CreditCard,
      open: () => go("credits"),
    },
  ];

  return <>
    <PageHead
      title={showBenchmark ? "Fit benchmark" : "Judge walkthrough"}
      sub={showBenchmark ? "Inspect the source behind each fit judgment." : "Follow a real buying signal from first evidence to approved outreach."}
    >
      <button className="btn" onClick={() => go(showBenchmark ? "demo" : "overview")}>
        {showBenchmark ? "Judge walkthrough" : "Opportunity desk"} <ArrowRight size={15}/>
      </button>
    </PageHead>
    {!showBenchmark && <><div className="judge-grid">
      {steps.map(({ title, description, action, icon: Icon, open }) => (
        <article className="panel judge-step" key={title}>
          <span className="judge-icon"><Icon size={19}/></span>
          <h2>{title}</h2>
          <p>{description}</p>
          <button className="btn" onClick={open}>{action} <ArrowRight size={14}/></button>
        </article>
      ))}
    </div>
    {s.mode === "rehearsal" && <section className="panel space-top">
      <SectionHead title="Try the credit limit" aside="Attempt a two-credit contact lookup with an isolated zero-credit rehearsal wallet.">
        <button className="btn" onClick={checkCreditLimit}>Test credit block</button>
      </SectionHead>
      {creditResult && <p className="benchmark-note" role="status">{creditResult}</p>}
    </section>}</>}
    <section className={"panel " + (showBenchmark ? "" : "space-top")} id="fit-benchmark">
      <SectionHead title="Reference fit benchmark" aside={benchmark.rule}>
        <button className="btn" aria-expanded={showEvidence} aria-controls="benchmark-evidence" onClick={() => setShowEvidence(value => !value)}>
          {showEvidence ? "Hide" : "View"} all judgments
        </button>
      </SectionHead>
      <div className="benchmark-summary">
        <div><small>Reference Precision@5</small><strong>{benchmarkResult.correct} / 5</strong></div>
        <div><small>Companies reviewed</small><strong>{benchmarkResult.count}</strong></div>
        <div><small>Relevant in the reference set</small><strong>{benchmarkResult.relevant} / {benchmarkResult.count}</strong></div>
      </div>
      <p className="benchmark-note">One rubric-based review on <DateText value={benchmark.reviewedOn} long/>. The demo ranks a curated five-account shortlist. These judgments measure fit for that shortlist. Live discovery and buying intent need separate evaluation.</p>
      <div id="benchmark-evidence" hidden={!showEvidence} className="table-scroll">
        <table className="detail-table benchmark-table">
          <thead><tr><th scope="col">Company</th><th scope="col">Fit</th><th scope="col">Basis</th><th scope="col">Evidence</th></tr></thead>
          <tbody>{benchmark.judgments.map(row => <tr key={row.name}>
            <th scope="row">{row.name}</th>
            <td><Chip tone={row.relevant ? "green" : "quiet"}>{row.relevant ? "Relevant" : "Outside scope"}</Chip></td>
            <td>{row.reason}</td>
            <td><a className="source-link" href={row.url} target="_blank" rel="noreferrer" aria-label={row.name + " source"}>Source <ArrowUpRight size={13}/></a></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  </>;
}
