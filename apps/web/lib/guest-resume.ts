type Session = {token:string;identity:string;entryInvite?:string;tabOnly?:boolean};
type Store = Pick<Storage,'getItem'|'setItem'|'removeItem'> & {setTabItem?:(key:string,value:string)=>void};
export const guestResumeKey=(studioId:string,room:string)=>`castlink-guest-resume:${JSON.stringify([studioId,room])}`;
/** Keep the tab's identity first, with signed recovery after that tab closes. */
export function guestResumeStorage():Store{
 let tab:Storage|undefined,durable:Storage|undefined;
 try{tab=globalThis.sessionStorage;}catch{}
 try{durable=globalThis.localStorage;}catch{}
 return{
  getItem(key){for(const storage of [tab,durable])try{const value=storage?.getItem(key);if(value!==null&&value!==undefined)return value;}catch{}return null;},
  setItem(key,value){for(const storage of [tab,durable])try{storage?.setItem(key,value);}catch{}},
  setTabItem(key,value){try{tab?.setItem(key,value);}catch{}},
  removeItem(key){
   let tabValue:string|null=null,durableValue:string|null=null;
   try{tabValue=tab?.getItem(key)??null;}catch{}
   try{durableValue=durable?.getItem(key)??null;}catch{}
   try{tab?.removeItem(key);}catch{}
   // A duplicate tab owns its own credential, not another caster's durable recovery.
   let matching=tabValue===null||tabValue===durableValue;
   if(!matching)try{const identity=JSON.parse(tabValue!).identity;matching=typeof identity==='string'&&identity===JSON.parse(durableValue||'null')?.identity;}catch{}
   if(matching)try{durable?.removeItem(key);}catch{}
  },
 };
}
/** Call only after the room invitation was accepted by the server. */
export function acceptGuestInvite(storage:Store|undefined,studioId:string,room:string,invite:string){
 const key=guestResumeKey(studioId,room);
 try{
  const saved=JSON.parse(storage?.getItem(key)||'null');
  if(saved?.entryInvite===invite)return;
  storage?.removeItem(key);
  // Preserve the entry binding until requestGuestSession receives its signed token.
  storage?.setItem(key,JSON.stringify({entryInvite:invite}));
 }catch{}
}
export async function requestGuestSession({studioId,room,name,storage,fetcher=fetch,signal,claim,fresh=false,personalInvite}:{studioId:string;room:string;name:string;storage?:Store;fetcher?:typeof fetch;signal?:AbortSignal;claim?:(identity:string)=>Promise<boolean>;fresh?:boolean;personalInvite?:string}) {
 const key=guestResumeKey(studioId,room);let prior:Session|undefined,entryInvite=personalInvite,tabOnly=false;
 try{const value=JSON.parse(storage?.getItem(key)||'null');if(entryInvite===undefined&&typeof value?.entryInvite==='string')entryInvite=value.entryInvite;if(typeof value?.token==='string'&&value.token.length<16384&&typeof value.identity==='string'&&value.identity.startsWith('guest-')&&(!personalInvite||value.entryInvite===personalInvite)){prior=value;tabOnly=value.tabOnly===true;}}catch{}
 if(fresh){prior=undefined;tabOnly=false;}
 if(prior&&claim&&!(await claim(prior.identity))){prior=undefined;tabOnly=true;}
 const issue=()=>{const query=new URLSearchParams({studioId,room,name,nameIntent:'join',role:'guest',...(prior?{identity:prior.identity}:{})});return fetcher('/api/token?'+query,{cache:'no-store',signal,headers:{...(prior?{authorization:`Bearer ${prior.token}`}:{}),...(personalInvite?{'x-castlink-caster-invite':personalInvite}:{})}});};
 let response=await issue();
 if(response.status===401&&prior){prior=undefined;try{storage?.removeItem(key);}catch{}response=await issue();}
 if(!response.ok){let message='Не удалось подключить кастера';try{const body=await response.json();message=body.error||message;}catch{}throw Error(message);}
 const data=await response.json();
 if(typeof data.token!=='string'||typeof data.identity!=='string'||!data.identity.startsWith('guest-'))throw Error('Сервер не выдал идентификатор кастера');
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 if(claim)await claim(data.identity);
 try{const value=JSON.stringify({token:data.token,identity:data.identity,...(entryInvite?{entryInvite}:{}),...(tabOnly?{tabOnly:true}:{})});if(tabOnly&&storage?.setTabItem)storage.setTabItem(key,value);else storage?.setItem(key,value);}catch{}
 return data;
}
const held=new Set<string>();
/** A duplicated browser tab must not take over the original caster identity. */
export async function claimGuestResumeIdentity(identity:string):Promise<boolean>{
 if(typeof navigator==='undefined'||!navigator.locks)return false;
 if(held.has(identity))return true;
 return new Promise(resolve=>{void navigator.locks.request(`castlink-guest-resume:${identity}`,{ifAvailable:true},lock=>{if(!lock){resolve(false);return;}held.add(identity);resolve(true);return new Promise<void>(()=>{});}).catch(()=>resolve(false));});
}
