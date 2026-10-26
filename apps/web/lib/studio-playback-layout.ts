'use client';
import {useEffect,type RefObject} from 'react';

// The owner chose this exact visible label; media track names remain unchanged.
export const STUDIO_PLAYBACK_TITLE='STUDIO PLAYBACK';

/** Budget the first studio screen from its actual top, without header offsets. */
export function useStudioPlaybackLayout(section:RefObject<HTMLElement|null>,active:boolean){
 useEffect(()=>{
  const element=section.current;
  if(!active||!element)return;
  let frame=0;
  const measure=()=>{
   const top=element.getBoundingClientRect().top+window.scrollY;
   const value=`${Math.max(0,Math.floor(window.innerHeight-top))}px`;
   if(element.style.getPropertyValue('--studio-playback-height')!==value)element.style.setProperty('--studio-playback-height',value);
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
  measure();
  const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(schedule);
  if(element.parentElement)observer?.observe(element.parentElement);
  // Room controls/notices above the layout can change its top without resizing it.
  if(element.parentElement?.parentElement)observer?.observe(element.parentElement.parentElement);
  window.addEventListener('resize',schedule);
  return()=>{observer?.disconnect();window.removeEventListener('resize',schedule);cancelAnimationFrame(frame);element.style.removeProperty('--studio-playback-height');};
 },[section,active]);
}
