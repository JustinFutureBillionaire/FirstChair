export const signalRules = {
  hiring: [25, 30], price_change: [20, 60], executive: [20, 60], funding: [15, 90],
  dissatisfaction: [20, 45], launch: [18, 60], negative: [-40, 120],
  pricing_model: [0, 60], product: [0, 60],
};
export const signalLabels = {
  hiring: "Hiring", price_change: "Pricing change", executive: "Leadership", funding: "Funding",
  dissatisfaction: "Vendor friction", negative: "Negative signal", pricing_model: "Rate card",
  product: "Company context", launch: "Product launch",
};
const words = text => String(text || "").toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>2);
export function score(account, icp, asOf) {
  const known = (account.sources || []).filter(s=>s.verified);
  const age = s => s.published ? Math.max(0,(Date.parse(asOf)-Date.parse(s.published))/86400000) : null;
  const fields = icp?.fields || {};
  const segmentText = [account.segment, account.description, account.domain, ...(account.tags || [])].join(" ").toLowerCase();
  const evidenceText = known.map(s=>s.quote).join(" ").toLowerCase();
  const hasMatch = (field, text) => field?.enabled !== false && words(field?.value).some(w=>text.includes(w));
  const fits = [
    ["Segment", (hasMatch(fields.segments,segmentText) || (icp.expansions||[]).some(e=>e.status==="Accepted"&&hasMatch({value:e.name},segmentText))) ? 20 : 0, 20],
    ["Operating model", hasMatch(fields.traits,evidenceText) ? 15 : 0, 15],
    ["Company size", account.size && hasMatch(fields.size,account.size) ? 8 : 0, 8],
    ["Geography", account.region && hasMatch(fields.regions,account.region) ? 7 : 0, 7],
  ];
  const fit = fits.reduce((a,f)=>a+f[1],0);
  const signals = known.map(s=>{
    const [weight, halfLife] = signalRules[s.kind] || [0,60];
    const days = age(s);
    const validDate = Number.isFinite(days) && Date.parse(s.published)<=Date.parse(asOf)+86400000;
    const used = validDate ? weight * .5 ** (days/halfLife) : 0;
    return {id:s.id, weight, halfLife, days:validDate?Math.round(days):null, points:used};
  });
  const intent = Math.max(-40, Math.min(50, signals.reduce((a,s)=>a+s.points,0)));
  const quality = known.length ? known.reduce((a,s)=>a+(s.source_type==="first_party"?1:0.8)*(age(s)>180?0.7:1),0)/known.length : 0;
  const priority = Math.max(0,Math.min(100, Math.round(fit + intent*quality)));
  return {fit, intent, quality, priority, fits, signals, tier:priority>=70?"A":priority>=50?"B":"C"};
}
export function orderedAccounts(state) {
  return state.accounts.map(a=>({...a, scoring:score(a,state.icp,state.asOf)}))
    .sort((a,b)=>b.scoring.priority-a.scoring.priority || a.name.localeCompare(b.name));
}
