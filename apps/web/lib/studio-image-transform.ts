import { validateImageTransform, type ImageTransform, imageTransformStyle } from './multiview-image';
/** Presentation only: never touches capture, sender tracks, codecs or caster consent. */
export function participantStudioImageTransform(metadata?: string): ImageTransform {
  try { const value = JSON.parse(metadata || '{}').studioImageTransform; return value === undefined ? {} : validateImageTransform(value); } catch { return {}; }
}
export function applyStudioImageTransform(video: Pick<HTMLVideoElement, 'style'>, metadata?: string) {
  Object.assign(video.style, imageTransformStyle(participantStudioImageTransform(metadata)));
}

// Optimistic presentation belongs only to this receiving Room instance.
const previews = new WeakMap<object, Map<string, {sid:string;value:ImageTransform}>>();
const listeners = new WeakMap<object, Set<()=>void>>();
export function setStudioImagePreview(room:object,identity:string,sid:string,value?:ImageTransform) {
  let entries=previews.get(room);if(!entries){entries=new Map();previews.set(room,entries);}
  if(value===undefined)entries.delete(identity);else entries.set(identity,{sid,value});
  listeners.get(room)?.forEach(listener=>listener());
}
export function studioImagePreview(room:object,identity:string,sid:string):ImageTransform|undefined {
  const entry=previews.get(room)?.get(identity);return entry?.sid===sid?entry.value:undefined;
}
export function subscribeStudioImagePreview(room:object,listener:()=>void) {
  let entries=listeners.get(room);if(!entries){entries=new Set();listeners.set(room,entries);}entries.add(listener);
  return ()=>{entries.delete(listener);};
}
