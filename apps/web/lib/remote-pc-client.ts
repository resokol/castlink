import { RoomEvent, type Room } from 'livekit-client';
import { REMOTE_PC_ENDPOINT, REMOTE_PC_PURPOSE, type RemotePcBrowserRequest, type RemotePcBeginResponse, type RemotePcResponse, type RemotePcSource, type RemotePcSession, type RemotePcController } from './remote-pc-protocol';
import { createRemotePcOwnerControlsRelay } from './remote-pc-controls-relay';
export type RemotePcView={sessions:readonly RemotePcSession[];sources:readonly RemotePcSource[];ready:boolean;error:boolean};
const empty:RemotePcView={sessions:[],sources:[],ready:false,error:false};
type Store={view:RemotePcView;listeners:Set<()=>void>;request?:(body:Record<string,unknown>)=>Promise<RemotePcResponse>;credentials:Map<string,RemotePcController>;updated:number;clockOffset:number;sequences:Map<string,{move:number;reliable:number}>};
const rooms=new WeakMap<Room,Store>();
function store(room:Room){let value=rooms.get(room);if(!value){value={view:empty,listeners:new Set(),credentials:new Map(),updated:0,clockOffset:0,sequences:new Map()};rooms.set(room,value);}return value;}
function notify(value:Store,view:RemotePcView){const old=value.view;const sessions=JSON.stringify(old.sessions)===JSON.stringify(view.sessions)?old.sessions:view.sessions,sources=JSON.stringify(old.sources)===JSON.stringify(view.sources)?old.sources:view.sources;if(old.ready===view.ready&&old.error===view.error&&sessions===old.sessions&&sources===old.sources)return;value.view={...view,sessions,sources};value.listeners.forEach(listener=>listener());}
export function remotePcSnapshot(room:Room){return store(room).view;}
export function subscribeRemotePc(room:Room,listener:()=>void){const value=store(room);value.listeners.add(listener);return()=>value.listeners.delete(listener);}
export function remotePcCredential(room:Room,id:string){const value=store(room),credential=value.credentials.get(id);return Date.now()-value.updated<=1100&&room.state==='connected'&&credential&&credential.expiresAt>Date.now()+value.clockOffset?credential:undefined;}
export function remotePcInputSequences(room:Room,grantId:string){const value=store(room);let sequences=value.sequences.get(grantId);if(!sequences){sequences={move:0,reliable:0};value.sequences.set(grantId,sequences);}return sequences;}
export function remotePcServerTime(room:Room){return Date.now()+store(room).clockOffset;}
export async function remotePcRequest(room:Room,body:Record<string,unknown>){const request=store(room).request;if(!request)throw new Error('Remote PC connection unavailable');return request(body);}
export function launchRemotePc(host:Window,ticket:string){
  const origin=new URL(host.location.origin);
  if(origin.protocol!=='https:'||!/^rp1_[A-Za-z0-9_-]{43}$/.test(ticket))throw new Error('Invalid remote PC launch');
  // Already-installed full clients keep their supported protocol. Browser
  // owners use the dedicated component without installing the full client.
  const desktop=(host as Window & {castlinkDesktop?:{version?:number}}).castlinkDesktop;
  const url=new URL(desktop?.version===1?'castlink-remote://connect':'castlink-share://connect');url.searchParams.set('server',origin.origin);url.hash=ticket;
  const frame=host.document.createElement('iframe');frame.hidden=true;frame.tabIndex=-1;frame.referrerPolicy='no-referrer';frame.setAttribute('aria-hidden','true');frame.src=url.href;host.document.body.appendChild(frame);host.setTimeout(()=>frame.remove(),30000);
}
export async function beginRemotePc(room:Room,host:Window,current:()=>boolean=()=>true){
  if(!current())throw new Error('Screen sharing cancelled');
  const result=await remotePcRequest(room,{action:'begin'}) as RemotePcBeginResponse;
  if(!current()){
    // Never launch a component for a room/button that was retired while begin
    // was in flight. Cancel only this exact unlaunched server generation.
    try{await remotePcRequest(room,{action:'stop',sessionId:result.session.id,generation:result.session.generation,revision:result.session.revision});}catch{}
    throw new Error('Screen sharing cancelled');
  }
  launchRemotePc(host,result.ticket);return result;
}
/** One authenticated polling owner per room; no typed input or secret is put in public room state. */
export function connectRemotePc(room:Room,context:{token:string;studioId:string;room:string}){
  const value=store(room),abort=new AbortController();let disposed=false,timer:ReturnType<typeof setTimeout>;
  const request=async(body:Record<string,unknown>)=>{
    const response=await fetch(REMOTE_PC_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+context.token},body:JSON.stringify({purpose:REMOTE_PC_PURPOSE,studioId:context.studioId,room:context.room,...body} satisfies Partial<RemotePcBrowserRequest>),credentials:'omit',cache:'no-store',redirect:'error',signal:abort.signal});
    if(!response.ok)throw Object.assign(new Error('Remote PC unavailable'),{status:response.status});
    const data=await response.json() as RemotePcResponse;if(disposed)throw new Error('Remote PC session ended');
    if(Number.isFinite(data.serverTime))value.clockOffset=data.serverTime-Date.now();
    return data;
  };
  value.request=request;
  const controls=createRemotePcOwnerControlsRelay({room,read:()=>({sessions:value.view.sessions,ready:value.view.ready,updatedAt:value.updated}),request});
  const clear=()=>{value.credentials.clear();value.updated=0;notify(value,{...value.view,ready:false});controls.sync();};
  const poll=async()=>{
    try{
      if(room.state!=='connected'){clear();return;}
      const data=await request({action:'read'});if(disposed)return;
      const sessions=data.sessions||[],sources=data.sources||[];
      const ids=new Set<string>();
      for(const session of sessions){
        const grant=session.grant;
        if(grant?.phase!=='active'||grant.controller.identity!==room.localParticipant.identity||grant.controller.sid!==room.localParticipant.sid)continue;
        ids.add(session.id);
        {
          const result=await request({action:'controller',sessionId:session.id,generation:session.generation});
          if(result.controller&&result.controller.grantId===grant.id&&result.controller.revision===grant.revision)value.credentials.set(session.id,result.controller);else value.credentials.delete(session.id);
        }
      }
      for(const id of value.credentials.keys())if(!ids.has(id))value.credentials.delete(id);
      value.updated=Date.now();notify(value,{sessions,sources,ready:true,error:false});controls.sync();
    }catch{if(!disposed){value.credentials.clear();value.updated=0;notify(value,{...value.view,ready:false,error:true});controls.sync();}}
    finally{if(!disposed)timer=setTimeout(poll,250);}
  };
  room.on(RoomEvent.Disconnected,clear);room.on(RoomEvent.Reconnecting,clear);void poll();
  return()=>{disposed=true;controls.dispose();abort.abort();clearTimeout(timer);room.off(RoomEvent.Disconnected,clear);room.off(RoomEvent.Reconnecting,clear);if(value.request===request)value.request=undefined;value.credentials.clear();value.updated=0;notify(value,empty);};
}

export function ownRemotePcSession(room:Room){return remotePcSnapshot(room).sessions.find(s=>s.owner.identity===room.localParticipant.identity&&s.owner.sid===room.localParticipant.sid&&s.phase!=='stopped');}
export async function stopOwnedRemotePc(room:Room){const session=ownRemotePcSession(room);if(!session)return false;await remotePcRequest(room,{action:'stop',sessionId:session.id,generation:session.generation,revision:session.revision});return true;}
