"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import benchmark from "../data/fit-benchmark.json";
import sample from "../data/prospects.json";
import { summarizeBenchmark } from "../lib/benchmark.mjs";
import { applyAction, initialState } from "../lib/workspace.mjs";
import { Chip } from "./ui";

export const benchmarkResult = summarizeBenchmark(initialState(sample), benchmark);

export function Benchmark() {
  const [open, setOpen] = useState(false);
  return <div className="bench">
    <h2 className="sub">How good is the ranking</h2>
    <p className="hint">We labeled 20 real companies by hand. Rule: {benchmark.rule.toLowerCase()} {benchmarkResult.correct} of the top 5 picks are a fit.</p>
    <button className="btn small" aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? "Hide the 20 labels" : "Show the 20 labels"}</button>
    {open && <div className="table-scroll"><table className="grid">
      <thead><tr><th scope="col">Company</th><th scope="col">Fit</th><th scope="col">Why</th><th scope="col">Source</th></tr></thead>
      <tbody>{benchmark.judgments.map(row => <tr key={row.name}>
        <th scope="row">{row.name}</th>
        <td><Chip tone={row.relevant ? "green" : "quiet"}>{row.relevant ? "Fit" : "Not a fit"}</Chip></td>
        <td>{row.reason}</td>
        <td><a href={row.url} target="_blank" rel="noreferrer" aria-label={row.name + " source"}>Open<ArrowUpRight size={12}/></a></td>
      </tr>)}</tbody>
    </table></div>}
  </div>;
}

// Runs the real credit guard against a separate zero-credit wallet, so the demo balance is untouched.
export function CreditBlockTest() {
  const [result, setResult] = useState("");
  async function run() {
    const example = initialState(sample);
    example.credits = 0;
    try { await applyAction(example, { kind: "enrich", id: "exa" }); setResult("The lookup was unexpectedly allowed."); }
    catch (error) { setResult(error.message); }
  }
  return <div className={"zero" + (result ? " blocked" : "")}>
    <div><b>What happens at zero credits</b><p>Run a 2-credit email lookup against an empty test wallet. Your real balance is not touched.</p>{result && <p role="status" className="blocked-msg">Blocked. {result}</p>}</div>
    <button className="btn small" onClick={run}>Try it</button>
  </div>;
}
