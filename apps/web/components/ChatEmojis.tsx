'use client';
import {Fragment,useId,useRef,useState,type RefObject} from 'react';
import {useI18n} from '@/components/I18nProvider';
import {CHAT_EMOJIS,insertChatEmoji,splitChatEmojis,type ChatEmoji} from '@/lib/chat-emojis';
import styles from './ChatEmojis.module.css';
export function emojiLabel(emoji:ChatEmoji,locale:string){return emoji.label[locale==='en'?1:locale==='zh-CN'?2:0];}
export function formatChatEmojis(text:string){return splitChatEmojis(text).map((part,index)=>typeof part==='string'?<Fragment key={index}>{part}</Fragment>:<img key={index} className={styles.emoji} src={`/emoticons/${part.id}.svg`} alt={part.value} draggable={false}/>);}
export function ChatEmojiPicker({input,disabled=false,onChange}:{input:RefObject<HTMLInputElement|null>;disabled?:boolean;onChange?:(value:string)=>void}){
 const {locale}=useI18n(),id=useId(),menu=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false);
 const title=locale==='en'?'Smileys':locale==='zh-CN'?'表情':'Смайлики';
 function position(){const box=trigger.current?.getBoundingClientRect(),target=menu.current;if(!box||!target)return;
  const width=Math.min(280,window.innerWidth-16),height=window.innerWidth<=700?190:184;
  target.style.left=`${Math.max(8,Math.min(box.right-width,window.innerWidth-width-8))}px`;
  target.style.top=`${Math.max(8,box.top-height-8)}px`;
 }
 function choose(emoji:ChatEmoji){const element=input.current;if(!element||disabled)return;
  const result=insertChatEmoji(element.value,emoji.value,element.selectionStart??element.value.length,element.selectionEnd??element.value.length);
  if(onChange)onChange(result.value);else element.value=result.value;
  menu.current?.hidePopover();requestAnimationFrame(()=>{element.focus();element.setSelectionRange(result.cursor,result.cursor);});
 }
 return <span className={styles.picker}><button ref={trigger} className={styles.trigger} type="button" disabled={disabled} aria-label={title} title={title} aria-expanded={open} aria-controls={id} popoverTarget={id} onClick={position}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 14q4 5 8 0M8 9h1m6 0h1"/></svg></button><div ref={menu} id={id} className={styles.menu} popover="auto" role="group" aria-label={title} onToggle={event=>setOpen(event.newState==='open')}>{CHAT_EMOJIS.map(emoji=><button key={emoji.id} type="button" disabled={disabled} title={emojiLabel(emoji,locale)} aria-label={emojiLabel(emoji,locale)} onClick={()=>choose(emoji)}><img src={`/emoticons/${emoji.id}.svg`} alt="" draggable={false}/></button>)}</div></span>;
}
