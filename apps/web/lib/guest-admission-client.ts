type Store=Pick<Storage,"getItem"|"setItem"|"removeItem">;
export const guestAdmissionKey=(studioId:string,room:string)=>`castlink-admission:${JSON.stringify([studioId,room])}`;
type Stored={clientId:string;capability?:string};
export function readAdmission(storage:Store|undefined,studioId:string,room:string):Stored|undefined{try{const value=JSON.parse(storage?.getItem(guestAdmissionKey(studioId,room))||"null");return typeof value?.clientId==="string"?value:undefined;}catch{return undefined;}}
function delay(ms:number,signal?:AbortSignal){return new Promise<void>((resolve,reject)=>{
 signal?.throwIfAborted();const finish=()=>{signal?.removeEventListener("abort",abort);resolve();};const timer=setTimeout(finish,ms);const abort=()=>{clearTimeout(timer);signal?.removeEventListener("abort",abort);reject(new DOMException("Aborted","AbortError"));};signal?.addEventListener("abort",abort,{once:true});
});}
export async function waitForGuestAdmission({studioId,room,name,storage,fetcher=fetch,signal,personalInvite,onWaiting,pollMs=1500}:{studioId:string;room:string;name:string;storage?:Store;fetcher?:typeof fetch;signal?:AbortSignal;personalInvite?:string;onWaiting?:()=>void;pollMs?:number}){
 signal?.throwIfAborted();let saved=readAdmission(storage,studioId,room)||{clientId:crypto.randomUUID()};
 const response=await fetcher("/api/guest-admission",{method:"POST",cache:"no-store",signal,headers:{"content-type":"application/json",...(saved.capability?{"x-castlink-guest-admission":saved.capability}:{})},body:JSON.stringify({action:"start",studioId,room,name,clientId:saved.clientId,invite:personalInvite})});
 const result=await response.json();if(!response.ok||typeof result.capability!=="string")throw Error(result.error||"Не удалось запросить допуск");
 saved={...saved,capability:result.capability};try{storage?.setItem(guestAdmissionKey(studioId,room),JSON.stringify(saved));}catch{}
 if(result.state==="admitted")return result.capability as string;
 onWaiting?.();
 while(true){
  await delay(pollMs,signal);
  const status=await fetcher(`/api/guest-admission?${new URLSearchParams({studioId,room})}`,{cache:"no-store",signal,headers:{"x-castlink-guest-admission":result.capability}});
  if(status.status===409||status.status===503)continue;
  const data=await status.json();if(!status.ok)throw Error(data.error||"Вход устарел");if(data.state==="admitted")return result.capability as string;
 }
}
