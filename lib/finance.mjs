export const pricingURL = "https://flexprice.io/pricing";
export const financeFields = {
  months: { label: "Engineering months to build", unit: "months", initial: 4, max: 60, step: 0.25 },
  rate: { label: "Loaded cost per engineer-month", unit: "$", initial: 15000, max: 250000, step: 100 },
  maintenance: { label: "Ongoing engineering allocation", unit: "%", initial: 20, max: 100, step: 1 },
  subscription: { label: "Monthly subscription", unit: "$", initial: 500, max: 10000000, step: 1, source: pricingURL },
  usage: { label: "Fee on annual billed volume", unit: "%", initial: 0.4, max: 100, step: 0.05, source: pricingURL },
  volume: { label: "Annual billed volume", unit: "$", initial: 1000000, max: 1000000000000, step: 1000 },
  integration: { label: "Engineering months to integrate", unit: "months", initial: 0.5, max: 12, step: 0.125 },
  setup: { label: "One-time external setup fee", unit: "$", initial: 0, max: 100000000, step: 10 },
  other: { label: "Other monthly ownership costs", unit: "$", initial: 0, max: 100000000, step: 10 },
  avoidable: { label: "Engineering spend avoidable in cash", unit: "%", initial: 0, max: 100, step: 5 },
};
export function initialInputs(isFlexprice = true) {
  return Object.fromEntries(Object.entries(financeFields).map(([key, field]) => [key, {
    value: field.source && !isFlexprice ? null : field.initial,
    origin: field.source ? (isFlexprice ? "Public" : "Unknown") : "Assumed",
    source: isFlexprice && field.source || null,
  }]));
}
export const scenarios = { Conservative: 0.65, Base: 1, Optimistic: 1.35 };
export function businessCase(inputs, scenario = "Base") {
  const v = {};
  for (const [key, spec] of Object.entries(financeFields)) {
    const value = inputs[key]?.value;
    if (value == null || value === "" || inputs[key].origin === "Unknown") return { complete: false, missing: spec.label };
    if (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > spec.max) return { complete: false, missing: spec.label };
    v[key] = Number(value);
  }
  const engineering = v.months * (scenarios[scenario] ?? 1);
  const buildThisYear = Math.min(12, engineering);
  const maintainMonths = (12 - buildThisYear) * v.maintenance / 100;
  const build = (buildThisYear + maintainMonths) * v.rate;
  const annualVendor = 12 * (v.subscription + v.other) + v.volume * v.usage / 100;
  const upfront = v.integration * v.rate + v.setup;
  const buy = annualVendor + upfront;
  const net = build - buy;
  const cashShare = v.avoidable / 100;
  const capacity = (buildThisYear + maintainMonths - v.integration) * (1 - cashShare);
  const cashNet = (build - v.integration * v.rate) * cashShare - annualVendor - v.setup;
  const curve = [0];
  let payback = upfront === 0 ? 0 : null;
  let balance = -upfront;
  curve[0] = balance;
  for (let m = 1; m <= 12; m++) {
    const buildPortion = Math.max(0, Math.min(1, engineering - (m - 1)));
    const delta = (buildPortion + (1 - buildPortion) * v.maintenance / 100) * v.rate - annualVendor / 12;
    if (payback === null && delta > 0 && balance + delta >= 0) payback = m - 1 - balance / delta;
    balance += delta;
    curve.push(balance);
  }
  return { complete: true, build, buy, net, cashNet, capacity, upfront, annualVendor,
    roi: buy > 0 ? 100 * net / buy : null, payback, curve };
}
export const dollars = (v, digits = 0) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: digits,
}).format(v);
