import { orderedAccounts } from "./scoring.mjs";

export function summarizeBenchmark(workspace, benchmark) {
  const top = orderedAccounts(workspace).slice(0, 5);
  const labels = new Map(benchmark.judgments.map(row => [row.name, row.relevant]));
  const complete = top.length === 5 && top.every(account => labels.has(account.name));

  return {
    top,
    count: labels.size,
    relevant: [...labels.values()].filter(Boolean).length,
    correct: complete ? top.filter(account => labels.get(account.name)).length : null,
  };
}
