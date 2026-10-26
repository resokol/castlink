'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {RoomEvent,type Room} from 'livekit-client';
import {useI18n} from '@/components/I18nProvider';
import {emojiLabel} from './ChatEmojis';
import {REACTION_IDS,emojiById,type ReactionId} from '@/lib/chat-emojis';
import {createRoomReactions,REACTION_DURATION,type RoomReaction} from '@/lib/room-reactions';
import styles from './RoomReactions.module.css';
export function RoomReactions({room}:{room:Room}){
 const {locale}=useI18n(),id=useId(),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);
 const controller=useRef<ReturnType<typeof createRoomReactions>|null>(null),timers=useRef(new Set<ReturnType<typeof setTimeout>>());
 const [connected,setConnected]=useState(room.state==='connected'),[open,setOpen]=useState(false),[error,setError]=useState(false),[events,setEvents]=useState<RoomReaction[]>([]),[host,setHost]=useState<HTMLElement|null>(null);
 const title=locale==='en'?'Reactions':locale==='zh-CN'?'互动表情':'Реакции';
 const failure=locale==='en'?'Could not send reaction. Try again.':locale==='zh-CN'?'表情发送失败，请重试。':'Не удалось отправить реакцию. Попробуйте ещё раз.';
 useEffect(()=>{
  if(!room.on||!room.localParticipant)return;
  const element=trigger.current?.closest('.lk-video-conference')?.querySelector<HTMLElement>('[data-scene-mode]');
  if(element){element.dataset.reactionsHost='true';element.classList.add(styles.host);setHost(element);}
  function clear(){for(const timer of timers.current)clearTimeout(timer);timers.current.clear();setEvents([]);setError(false);menu.current?.hidePopover();}
  const session=createRoomReactions(room,reaction=>{setEvents(previous=>[...previous.slice(-3),reaction]);const timer=setTimeout(()=>{timers.current.delete(timer);setEvents(previous=>previous.filter(value=>value.id!==reaction.id));},REACTION_DURATION+100);timers.current.add(timer);},clear);
  controller.current=session;
  const changed=()=>setConnected(room.state==='connected');room.on(RoomEvent.ConnectionStateChanged,changed);
  return()=>{session.dispose();room.off(RoomEvent.ConnectionStateChanged,changed);if(controller.current===session)controller.current=null;for(const timer of timers.current)clearTimeout(timer);timers.current.clear();if(element){delete element.dataset.reactionsHost;element.classList.remove(styles.host);}};
 },[room]);
 async function send(emoji:ReactionId){const session=controller.current;if(!session)return;menu.current?.hidePopover();setError(false);try{await session.send(emoji);}catch{if(controller.current===session)setError(true);}}
 function position(){const rect=trigger.current?.getBoundingClientRect(),target=menu.current;if(!rect||!target)return;
  const width=window.innerWidth<=700?318:310;target.style.left=`${Math.max(8,Math.min(rect.left+rect.width/2-width/2,window.innerWidth-width-8))}px`;target.style.top=`${Math.max(8,rect.top-64)}px`;
 }
 return <span className={styles.control}><button ref={trigger} className={`${styles.trigger} caster-reactions-toggle`} type="button" disabled={!connected} aria-label={title} title={title} aria-expanded={open} aria-controls={id} popoverTarget={id} onClick={position}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 14q4 5 8 0M8 9h1m6 0h1"/></svg><span>{title}</span></button><div ref={menu} id={id} popover="auto" className={styles.menu} role="group" aria-label={title} onToggle={event=>setOpen(event.newState==='open')}>{REACTION_IDS.map(value=>{const emoji=emojiById(value);return <button key={value} type="button" disabled={!connected} title={emojiLabel(emoji,locale)} aria-label={emojiLabel(emoji,locale)} onClick={()=>void send(value)}><img src={`/emoticons/${value}.svg`} alt="" draggable={false}/></button>;})}</div>{error&&<span className={styles.status} role="alert">{failure}</span>}{host&&createPortal(<div className={styles.layer} aria-hidden="true" style={{top:host.querySelector('header')?.offsetHeight??56}}>{events.map(event=><div className={styles.burst} key={event.id}><img src={`/emoticons/${event.emoji}.svg`} alt=""/><img className={styles.spark} src={`/emoticons/${event.emoji}.svg`} alt=""/><img className={styles.spark} src={`/emoticons/${event.emoji}.svg`} alt=""/></div>)}</div>,host)}</span>;
}
