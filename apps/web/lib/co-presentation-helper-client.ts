import type { NativePresentation, PowerPointBridge, PreparedPptx } from './co-presentation-native';
export type HelperPowerPointBridge = PowerPointBridge & {
  version: 2;
  pair(): Promise<{code:string;expiresAt:number}>;
  connection(): Promise<{connected:boolean}>;
  dispose(): void;
};
export function createHelperPowerPointBridge({ token, studioId, room }: {token:string;studioId:string;room:string}): HelperPowerPointBridge {
  let disposed=false, busy=false, generation=0, pairingId:string|undefined;
  const controllers=new Set<AbortController>();
  async function post(body:Record<string,unknown>,timeout=10000) {
    const controller=new AbortController();controllers.add(controller);
    const timer=setTimeout(()=>controller.abort(),timeout);
    try {
      const response=await fetch('/api/co-presentation-helper',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({studioId,room,...(pairingId?{pairingId}:{}),...body}),cache:'no-store',credentials:'omit',redirect:'error',signal:controller.signal});
      if(!response.ok)throw Object.assign(new Error('Presentation helper unavailable'),{status:response.status});
      return await response.json();
    } finally {clearTimeout(timer);controllers.delete(controller);}
  }
  async function rpc(method:string,args:Record<string,unknown>={}) {
    if(disposed || busy)throw new Error('Presentation helper unavailable or busy');
    busy=true;const epoch=generation;
    const duration=method==='prepare'||method==='start'?180000:method==='status'?5000:method==='step'?Math.max(1,Math.min(3000,(args.expiresAt as number)-Date.now())):15000;
    const deadline=Date.now()+duration;
    try {
      // This mutation is sent exactly once. A lost response is ambiguous and
      // requires a new explicit user action; never automatically re-execute.
      const queued=await post({action:'request',clientRequestId:crypto.randomUUID(),method,args},Math.min(10000,duration));
      while(!disposed && generation===epoch && Date.now()<deadline) {
        let state;
        try {state=await post({action:'result',operationId:queued.operationId},Math.max(1,Math.min(5000,deadline-Date.now())));}
        catch(error) {
          if([401,403,409].includes((error as {status:number}).status))throw error;
          if(Date.now()>=deadline)throw error;
          await new Promise(resolve=>setTimeout(resolve,200));continue;
        }
        if(state.done) {
          if(disposed || generation!==epoch || state.error || state.result?.error)throw new Error('Presentation helper operation not confirmed');
          return state.result;
        }
        await new Promise(resolve=>setTimeout(resolve,200));
      }
      throw new Error('Presentation helper operation timed out; effect is uncertain');
    } finally {busy=false;}
  }
  return {
    version:2,
    async pair(){if(disposed)throw new Error('Presentation helper disposed');const value=await post({action:'pair'});pairingId=value.pairingId;return {code:value.code,expiresAt:value.expiresAt};},
    async connection(){if(disposed)return {connected:false};const value=await post({action:'state'},5000);if(!pairingId)pairingId=value.pairingId;return {connected:value.connected===true};},
    prepare:()=>rpc('prepare') as Promise<PreparedPptx|null>,
    start:value=>rpc('start',value) as Promise<NativePresentation>,
    step:value=>rpc('step',value) as Promise<{commandId:string;status:NativePresentation}>,
    connect:()=>rpc('connect') as Promise<NativePresentation>,
    status:id=>rpc('status',{id}) as Promise<NativePresentation>,
    async goTo(){throw new Error('Helper requires animation-step navigation');},
    async disconnect(id){await rpc('disconnect',{id});},
    dispose(){
      if(disposed)return;disposed=true;generation++;
      controllers.forEach(controller=>controller.abort());
      if(pairingId)void post({action:'disconnect'},5000).catch(()=>undefined);
    },
  };
}
