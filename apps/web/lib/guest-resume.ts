type Session = {token:string;identity:string};
type Store = Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export const guestResumeKey=(studioId:string,room:string)=>`castlink-guest-resume:${JSON.stringify([studioId,room])}`;
export async function requestGuestSession({studioId,room,name,storage,fetcher=fetch,signal,claim,fresh=false,personalInvite}:{studioId:string;room:string;name:string;storage?:Store;fetcher?:typeof fetch;signal?:AbortSignal;claim?:(identity:string)=>Promise<boolean>;fresh?:boolean;personalInvite?:string}) {
 const key=guestResumeKey(studioId,room);let prior:Session|undefined;
 try{const value=JSON.parse(storage?.getItem(key)||'null');if(typeof value?.token==='string'&&value.token.length<16384&&typeof value.identity==='string'&&value.identity.startsWith('guest-'))prior=value;}catch{}
 if(fresh)prior=undefined;
 if(prior&&claim&&!(await claim(prior.identity)))prior=undefined;
 const issue=()=>{const query=new URLSearchParams({studioId,room,name,role:'guest',...(prior?{identity:prior.identity}:{})});return fetcher('/api/token?'+query,{cache:'no-store',signal,headers:{...(prior?{authorization:`Bearer ${prior.token}`}:{}),...(personalInvite?{'x-castlink-caster-invite':personalInvite}:{})}});};
 let response=await issue();
 if(response.status===401&&prior){prior=undefined;try{storage?.removeItem(key);}catch{}response=await issue();}
 if(!response.ok){let message='Не удалось подключить кастера';try{const body=await response.json();message=body.error||message;}catch{}throw Error(message);}
 const data=await response.json();
 if(typeof data.token!=='string'||typeof data.identity!=='string'||!data.identity.startsWith('guest-'))throw Error('Сервер не выдал идентификатор кастера');
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 if(claim)await claim(data.identity);
 try{storage?.setItem(key,JSON.stringify({token:data.token,identity:data.identity}));}catch{}
 return data;
}
const held=new Set<string>();
/** A duplicated browser tab must not take over the original caster identity. */
export async function claimGuestResumeIdentity(identity:string):Promise<boolean>{
 if(typeof navigator==='undefined'||!navigator.locks)return false;
 if(held.has(identity))return true;
 return new Promise(resolve=>{void navigator.locks.request(`castlink-guest-resume:${identity}`,{ifAvailable:true},lock=>{if(!lock){resolve(false);return;}held.add(identity);resolve(true);return new Promise<void>(()=>{});}).catch(()=>resolve(false));});
}
