// Production controls and artwork; paired in-memory LiveKit adapters, no SFU/devices.
import {useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ChatEntry} from '@livekit/components-react';
import {RoomEvent,type Room} from 'livekit-client';
import {I18nProvider} from '@/components/I18nProvider';
import {ConferenceScene} from '@/components/ConferenceScene';
import {RoomReactions} from '@/components/RoomReactions';
import {ChatEmojiPicker,formatChatEmojis} from '@/components/ChatEmojis';
import {REACTION_TOPIC} from '@/lib/room-reactions';
const packets:unknown[]=[];
function makeRoom(identity:string){
 const listeners=new Map<string,Set<(...args:any[])=>void>>();
 const room={state:'connected',name:'qa-room',remoteParticipants:new Map(),activeSpeakers:[],localParticipant:{identity,sid:'SID-'+identity,metadata:'{"role":"guest"}',publishData:async(payload:Uint8Array,options:any)=>{packets.push({topic:options.topic,reliable:options.reliable});const other=room===one?two:one;other.emit(RoomEvent.DataReceived,payload,other.remoteParticipants.get(identity),undefined,options.topic);}},on(event:string,fn:(...args:any[])=>void){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event)!.add(fn);return this;},off(event:string,fn:(...args:any[])=>void){listeners.get(event)?.delete(fn);return this;},emit(event:string,...args:any[]){for(const fn of listeners.get(event)||[])fn(...args);}};
 return room;
}
const one=makeRoom('guest-one'),two=makeRoom('guest-two');
one.remoteParticipants.set('guest-two',{identity:'guest-two',sid:'SID-guest-two',metadata:'{"role":"guest"}'});two.remoteParticipants.set('guest-one',{identity:'guest-one',sid:'SID-guest-one',metadata:'{"role":"guest"}'});
Object.assign(window,{qaPackets:packets,qaDisconnect:()=>{one.state='disconnected';one.emit(RoomEvent.ConnectionStateChanged,'disconnected');one.emit(RoomEvent.Disconnected);},qaReactionTopic:REACTION_TOPIC});
function Panel({room,receiver=false}:{room:ReturnType<typeof makeRoom>;receiver?:boolean}){
 const input=useRef<HTMLInputElement>(null),[text,setText]=useState(''),[messages,setMessages]=useState<string[]>([]);
 return <section className="lk-video-conference qa-panel" data-panel={receiver?'receiver':'sender'}><div className="qa-scene"><ConferenceScene room={room as unknown as Room} items={Array.from({length:4},(_,i)=>({id:'camera-'+i,identity:'guest-'+i,kind:'camera' as const,node:<div className="qa-tile">Кастер {i+1}</div>}))}/></div><div className="guest-control-row"><button>Чат</button><RoomReactions room={room as unknown as Room}/><button>Демонстрация экрана</button></div><aside className="qa-chat"><ul>{messages.map((message,i)=><ChatEntry key={i} entry={{id:String(i),message,timestamp:1}} messageFormatter={formatChatEmojis}/>)}</ul><form onSubmit={event=>{event.preventDefault();if(text.trim()){setMessages(previous=>[...previous,text]);setText('');}}}><input aria-label="Сообщение" ref={input} value={text} onChange={event=>setText(event.target.value)} maxLength={4000}/><ChatEmojiPicker input={input} onChange={setText}/><button type="submit">Отправить</button></form></aside></section>;
}
function App(){return <I18nProvider><main className="qa-duo"><Panel room={one}/><Panel room={two} receiver/></main></I18nProvider>;}
createRoot(document.getElementById('root')!).render(<App/>);
