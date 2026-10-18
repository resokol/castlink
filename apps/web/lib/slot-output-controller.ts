import type { RemoteTrack } from "livekit-client";
import type { createOutputTrackBindings } from "./output-track-bindings";
import type { CasterSession, CasterSlot } from "./caster-slot-types";
export type SlotOutputSnapshot={revision:number;phase:CasterSlot["phase"];target:CasterSession|null;source:"camera"|"screen"};
type Bindings=Pick<ReturnType<typeof createOutputTrackBindings>,"attach"|"detach"|"clear">;
const sameSession=(a:CasterSession|null,b:CasterSession|null)=>a?.sessionId===b?.sessionId&&a?.identity===b?.identity&&a?.generation===b?.generation&&a?.participantSid===b?.participantSid;
export function createSlotOutputController(bindings:Bindings){
 let current:SlotOutputSnapshot|null=null,disposed=false;
 return{
  applySnapshot(next:SlotOutputSnapshot){
   if(disposed||current&&next.revision<current.revision)return;
   if(!current||current.phase!==next.phase||current.source!==next.source||!sameSession(current.target,next.target))bindings.clear();
   current=next;
  },
  trackSubscribed(track:RemoteTrack,session:CasterSession,revision:number){
   if(disposed||!current||current.revision!==revision||current.phase!=="assigned"||!current.target||!sameSession(current.target,session))return;
   const allowed=current.source==="camera"?["camera","microphone"]:["screen_share","screen_share_audio"];
   if(allowed.includes(track.source))bindings.attach(track);
  },
  trackUnsubscribed(track:RemoteTrack){if(!disposed)bindings.detach(track);},
  clear(){bindings.clear();},
  dispose(){disposed=true;current=null;bindings.clear();},
 };
}
