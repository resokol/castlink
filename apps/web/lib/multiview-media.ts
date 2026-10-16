import type { MultiviewTile } from './multiview';
type VideoTrack = { attach(element: HTMLVideoElement): unknown; detach(element: HTMLVideoElement): unknown; mediaStreamTrack?: {readyState:string} };
/** Owns this element only; never changes subscriptions or other studio previews. */
export function bindMultiviewVideo(element: HTMLVideoElement, changed: (available:boolean)=>void) {
  let attached: VideoTrack | undefined;
  const clear = () => { attached?.detach(element); attached=undefined; element.srcObject=null; element.hidden=true; changed(false); };
  return { clear, update(publication?:{track?:VideoTrack;isMuted:boolean}) {
    const track=publication?.track;
    if (!track || publication?.isMuted || track.mediaStreamTrack?.readyState==='ended') { clear(); return; }
    if (attached!==track) { clear();track.attach(element);attached=track; }
    element.hidden=false;changed(true);
  }};
}
export function uniqueMultiviewAudio(tiles: Pick<MultiviewTile,'sourceIdentity'|'source'|'muted'>[]) {
  const seen=new Set<string>();
  return tiles.filter(tile=>{const key=tile.sourceIdentity+':'+tile.source;if(tile.muted||!tile.sourceIdentity||seen.has(key))return false;seen.add(key);return true;});
}
