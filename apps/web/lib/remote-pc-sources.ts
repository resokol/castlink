import { Track, type Participant, type Room, type TrackPublication } from 'livekit-client';
import type { RemotePcSource } from './remote-pc-protocol';
export const isRemotePcHelper = (identity:string) => identity.startsWith('remote-pc-');
function participant(room:Room,identity:string) { return room.localParticipant.identity===identity?room.localParticipant:room.remoteParticipants.get(identity); }
export function validRemotePcSource(room:Room,source:RemotePcSource) {
  if(room.state!=='connected')return;
  const owner=participant(room,source.owner.identity),helper=participant(room,source.helper.identity);
  if(!owner||owner.sid!==source.owner.sid||!helper||helper.sid!==source.helper.sid)return;
  const publication=helper.getTrackPublication(Track.Source.ScreenShare);
  if(!publication||publication.trackSid!==source.videoTrackSid||publication.source!==Track.Source.ScreenShare)return;
  return {owner,participant:helper,publication,source};
}
export function resolveRemotePcScreen(room:Room,identity:string,sources:readonly RemotePcSource[]) {
  for(const source of sources)if(source.owner.identity===identity){const valid=validRemotePcSource(room,source);if(valid)return valid;}
  const owner=participant(room,identity),publication=owner?.getTrackPublication(Track.Source.ScreenShare);
  if(owner&&publication&&!isRemotePcHelper(owner.identity))return {owner,participant:owner,publication,source:undefined};
}
export function remotePcTrackOwner(room:Room,ref:{participant:Participant;source:Track.Source;publication?:TrackPublication},sources:readonly RemotePcSource[]) {
  if(ref.source!==Track.Source.ScreenShare&&ref.source!==Track.Source.ScreenShareAudio)return isRemotePcHelper(ref.participant.identity)?undefined:ref.participant;
  for(const source of sources){
    if(source.helper.identity!==ref.participant.identity||source.helper.sid!==ref.participant.sid)continue;
    const expected=ref.source===Track.Source.ScreenShare?source.videoTrackSid:source.audioTrackSid;
    if(expected!==ref.publication?.trackSid)continue;
    const valid=validRemotePcSource(room,source);if(valid)return valid.owner;
  }
  return isRemotePcHelper(ref.participant.identity)?undefined:ref.participant;
}
/** Presentation identity is separate from the untouched SDK TrackRef. */
export function remotePcHumanTracks<T extends {participant:Participant;source:Track.Source;publication?:TrackPublication}>(room:Room,tracks:readonly T[],sources:readonly RemotePcSource[]) {
  return tracks.flatMap(trackRef=>{const owner=remotePcTrackOwner(room,trackRef,sources);return owner?[{trackRef,owner}]:[];});
}
/** Human output URLs keep their identity; only ScreenShare publications may resolve through a helper. */
export function remotePcOutputMatches(room:Room,identity:string,mode:string,publication:TrackPublication,publisher:Participant,sources:readonly RemotePcSource[]){
  if(mode!=='screen')return publisher.identity===identity&&(publication.source===Track.Source.Camera||publication.source===Track.Source.Microphone);
  const resolved=resolveRemotePcScreen(room,identity,sources);
  if(!resolved||resolved.participant!==publisher)return false;
  if(publication.source===Track.Source.ScreenShare)return publication.trackSid===resolved.publication.trackSid;
  if(publication.source!==Track.Source.ScreenShareAudio)return false;
  return resolved.source?publication.trackSid===resolved.source.audioTrackSid:true;
}
