import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { requestedStudioId, mediaRoomName } from "@/lib/studio-scope";
import { hasHostedAccess } from "@/lib/hosted-access";
import { readCasterSlot } from "@/lib/caster-slot-store";
import { verifySlotOutputAccess } from "@/lib/caster-slot-access";
import { roomForSlotScope, slotRoomVersion } from "@/lib/slot-room-scope";
import { confirmCasterSlot, admissionHasSlot } from "@/lib/caster-slot-service";
import { admissionForPublication } from "@/lib/guest-admission-store";
import { consumeRateLimit } from "@/lib/rate-limit";
export const dynamic="force-dynamic";const headers={"Cache-Control":"no-store"};
const bad=(error:string,status=403)=>NextResponse.json({error},{status,headers});
export async function GET(request:NextRequest){try{
 if(!hasHostedAccess(request))return bad("Недостаточно прав");
 const studioId=requestedStudioId(request),id=request.nextUrl.searchParams.get("slot")||"",source=request.nextUrl.searchParams.get("source");
 if(!["camera","screen"].includes(source||""))return bad("Недопустимый источник",400);
 const kind=source as "camera"|"screen";let slot=await readCasterSlot(studioId,id);
 if(!slot||!await verifySlotOutputAccess(request.headers.get("x-castlink-slot-access")||"",slot.scope,id,kind))return bad("Ссылка выхода недействительна");
 const room=await roomForSlotScope(slot.scope);if(!room)return bad("Слот удалён",410);
 if(slot.assignment&&!slot.transition){slot=await confirmCasterSlot(slot.scope,id)||slot;}
 let target=slot.phase==="assigned"&&!slot.transition?slot.assignment:null;
 if(target){const admission=await admissionForPublication(target.sessionId,slot.scope,slotRoomVersion(room));if(!admission||!await admissionHasSlot(admission))target=null;}
 // Same read-only room subscription grant as existing /output. Source filtering
 // is playback routing, not a confidentiality boundary between room sources.
 const client=request.nextUrl.searchParams.get("client")||randomUUID();if(!/^[a-f0-9-]{36}$/.test(client))return bad("Некорректный клиент",400);
 if(!consumeRateLimit(request,{scope:"slot-output",subject:`${id}:${kind}:${client}`,limit:180,windowMs:60000}).ok)return bad("Слишком много запросов",429);
 const identity=`slot-output-${id}-${kind}-${client}`;
 const token=new AccessToken(process.env.LIVEKIT_API_KEY,process.env.LIVEKIT_API_SECRET,{identity,ttl:"1m",metadata:JSON.stringify({role:"output",studioId,slotId:id,source:kind})});
 token.addGrant({roomJoin:true,room:mediaRoomName(studioId,room.name),canPublish:false,canPublishData:false,canSubscribe:true,canUpdateOwnMetadata:false,hidden:true});
 return NextResponse.json({snapshot:{revision:slot.revision,phase:target?"assigned":slot.phase==="assigned"?"disconnected":slot.phase,target,source:kind},room:mediaRoomName(studioId,room.name),token:await token.toJwt(),identity},{headers});
}catch{return bad("Выход временно недоступен",503);}}
