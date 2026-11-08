'use client';
import {useEffect,type RefObject} from 'react';

// The owner chose this exact visible label; media track names remain unchanged.
export const STUDIO_PLAYBACK_TITLE='STUDIO PLAYBACK';

/** Budget the studio workspace from its actual top, without header offsets. */
export function useStudioPlaybackLayout(section:RefObject<HTMLElement|null>,active:boolean){
 useEffect(()=>{
  const element=section.current;
  if(!active||!element)return;
  const layout=element.closest<HTMLElement>('.studio-return-layout')||element;
  let frame=0;
  const measure=()=>{
   // Desktop exposes the existing section/hero children to the workspace grid.
   // A display:contents section has no box; its parent remains measurable.
   const top=layout.getBoundingClientRect().top+window.scrollY;
   const value=`${Math.max(0,Math.floor(window.innerHeight-top))}px`;
   for(const target of new Set([element,layout]))if(target.style.getPropertyValue('--studio-playback-height')!==value)target.style.setProperty('--studio-playback-height',value);
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
  measure();
  const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(schedule);
  if(layout.parentElement)observer?.observe(layout.parentElement);
  // Room controls/notices above the layout can change its top without resizing it.
  if(layout.parentElement?.parentElement)observer?.observe(layout.parentElement.parentElement);
  window.addEventListener('resize',schedule);
  return()=>{observer?.disconnect();window.removeEventListener('resize',schedule);cancelAnimationFrame(frame);for(const target of new Set([element,layout]))target.style.removeProperty('--studio-playback-height');};
 },[section,active]);
}
