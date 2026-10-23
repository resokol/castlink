import {RoomEvent, type Room, type RemoteParticipant} from 'livekit-client';
import {REACTION_IDS, type ReactionId} from './chat-emojis';
export const REACTION_TOPIC='castlink.room-reaction.v1';
export const REACTION_DURATION=2000;
const COOLDOWN=750, MAX_AGE=10000;
export type RoomReaction={id:string;emoji:ReactionId;sender:string};
/** Ephemeral data only: never write reactions to chat, storage or clean outputs. */
export function createRoomReactions(room:Room, show:(reaction:RoomReaction)=>void, reset:()=>void, now=Date.now) {
  let active=true,epoch=0,lastSent=-Infinity;
  const seen=new Map<string,number>(),lastPeer=new Map<string,number>();
  const receive=(payload:Uint8Array,participant?:RemoteParticipant,_kind?:unknown,topic?:string)=>{
    if(!active||room.state!=='connected'||topic!==REACTION_TOPIC||!participant||!payload||payload.length>512)return;
    const current=room.remoteParticipants.get(participant.identity);
    if(!current||current.sid!==participant.sid)return;
    try {
      if(JSON.parse(current.metadata||'{}').role!=='guest')return;
      const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(payload)),time=now();
      if(data?.v!==1||typeof data.id!=='string'||!/^[\w-]{1,64}$/.test(data.id)||!REACTION_IDS.includes(data.emoji)||!Number.isSafeInteger(data.sentAt))return;
      // Sender wall clocks need not match this device. Expiry below is local.
      const sender=current.identity+':'+current.sid,key=sender+':'+data.id;
      if(seen.has(key)||time-(lastPeer.get(sender)??-Infinity)<COOLDOWN)return;
      for(const [key,date]of seen)if(time-date>MAX_AGE)seen.delete(key);
      if(seen.size>=256)seen.delete(seen.keys().next().value!);
      // Bound memory independently of roster churn.
      if(lastPeer.size>=256)lastPeer.delete(lastPeer.keys().next().value!);
      seen.set(key,time);lastPeer.set(sender,time);show({id:key,emoji:data.emoji,sender:current.identity});
    }catch{/* Unknown versions and malformed peer packets never affect the room. */}
  };
  const disconnected=()=>{epoch++;seen.clear();lastPeer.clear();lastSent=-Infinity;reset();};
  room.on(RoomEvent.DataReceived,receive);room.on(RoomEvent.Disconnected,disconnected);
  return {
    async send(emoji:ReactionId){
      if(!active||room.state!=='connected'||!REACTION_IDS.includes(emoji))throw Error('Reaction unavailable');
      const time=now();if(time-lastSent<COOLDOWN)return;lastSent=time;
      const version=epoch,sid=room.localParticipant.sid,id=crypto.randomUUID();
      await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({v:1,id,emoji,sentAt:time})),{reliable:false,topic:REACTION_TOPIC});
      if(active&&version===epoch&&room.state==='connected'&&room.localParticipant.sid===sid)show({id,emoji,sender:room.localParticipant.identity});
    },
    dispose(){active=false;epoch++;seen.clear();lastPeer.clear();room.off(RoomEvent.DataReceived,receive);room.off(RoomEvent.Disconnected,disconnected);},
  };
}
