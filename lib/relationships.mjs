export const workHistory = [
 {account:"modal",person:"Erik Bernhardsson",previous:"Spotify",source:"https://erikbern.com/about.html"},
 {account:"modal",person:"Erik Bernhardsson",previous:"Better",aliases:["Better.com"],source:"https://erikbern.com/about.html"},
];
export function relationship(state,account,kind) {
 if(kind==="warm"){
   const references=state.product.customers.split(/[,;\n]/).map(x=>x.trim().toLowerCase()).filter(Boolean);
   const link=workHistory.find(x=>x.account===account.id&&[x.previous,...(x.aliases||[])].some(n=>references.includes(n.toLowerCase())));
   if(link&&account.sources.some(s=>s.verified))return {id:account.id,reason:link.person+" previously worked at "+link.previous+", which you marked as a reference customer. Ask your reference whether an introduction is appropriate.",source:link.source};
 }else if(kind==="displacement" && account.incumbent){
   const signal=account.sources.find(s=>s.verified&&s.kind==="dissatisfaction"&&s.published&&s.incumbent?.toLowerCase()===account.incumbent.name.toLowerCase()&&Date.parse(s.published)<=Date.parse(state.asOf)&&Date.parse(state.asOf)-Date.parse(s.published)<=90*86400000);
   if(signal)return {id:account.id,reason:"A checked source names "+account.incumbent.name+" and describes recent friction.",source:signal.url};
 }
 return null;
}
