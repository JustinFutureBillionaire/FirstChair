import {Agent,GenericAdapter,loadAgentConfigFromEnv} from "@band-ai/sdk";
import {roles} from "../lib/handoffs.mjs";
const env=process.env,room=env.BAND_ROOM_ID,root=env.FIRSTCHAIR_BACKEND_URL||"http://127.0.0.1:8400";
if(!room||!env.FIRSTCHAIR_BAND_WORKER_TOKEN||!env.BAND_HUMAN_ID)throw Error("Set the Band room, human participant, and backend worker token.");
const identities=Object.fromEntries(roles.map(role=>[role,loadAgentConfigFromEnv({prefix:"BAND_"+role+"_"})]));
function predecessors(role){return {PLANNER:["REVIEWER"],RESEARCHER:["PLANNER"],ANALYST:["RESEARCHER"],WRITER:["ANALYST","REVIEWER"],REVIEWER:["WRITER"]}[role];}
const agents=roles.map(role=>Agent.create({config:identities[role],adapter:new GenericAdapter(async({message,tools,roomId})=>{
 const match=message.content.match(/FirstChair job ([\da-f-]{36}) turn (\d+)/i);
 if(roomId!==room||!match||!predecessors(role).some(r=>identities[r].agentId===message.senderId)){await tools.turn.settle();return;}
 const response=await fetch(root+"/api/band/turn",{method:"POST",headers:{"Content-Type":"application/json","X-Band-Worker":env.FIRSTCHAIR_BAND_WORKER_TOKEN},body:JSON.stringify({job:match[1],turn:Number(match[2]),role})});
 if(!response.ok)throw Error("The workspace could not process the Band turn ("+response.status+").");
 const output=await response.json();const id=output.next==="HUMAN"?env.BAND_HUMAN_ID:identities[output.next].agentId;
 const text=output.next==="HUMAN"?output.summary+" Open First Chair → Outreach review.":"FirstChair job "+match[1]+" turn "+(Number(match[2])+1)+". "+output.summary+" Evidence: "+(output.sourceIds||[]).join(", ");
 await tools.sendMessage(text,[{id}]);
})}));
await Promise.all(agents.map(agent=>agent.run()));
