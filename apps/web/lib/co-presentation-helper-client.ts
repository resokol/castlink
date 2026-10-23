import { nativePresentationErrorCode, type NativeControlledPresentation, type PowerPointBridge, type PreparedPresentation } from './co-presentation-native';
/** One-use bootstrap stays in the fragment and never includes room JWTs. */
export const PRESENTER_INSTALLER_URL = 'https://castlink.ru/general/presenter/CastLink-Client-Preview-Setup.exe';
export function presentationHelperLaunchUrl(origin: string, ticket: string) {
  const server = new URL(origin);
  if (server.protocol !== 'https:' || server.username || server.password || server.pathname !== '/' || server.search || server.hash || !/^cp2_[A-Za-z0-9_-]{43}$/.test(ticket)) throw new Error('Invalid presenter launch');
  const launch = new URL('castlink-presenter://connect');
  launch.searchParams.set('server', server.origin);
  launch.hash = ticket;
  return launch.href;
}
const presenterLaunchFrames = new WeakMap<Window, {frame: HTMLIFrameElement; timer: number}>();
/** Keep external protocol navigation out of the conference's page-leave lifecycle. */
export function launchPresentationHelper(host: Window, ticket: string): void {
  const url = presentationHelperLaunchUrl(host.location.origin, ticket), body = host.document.body;
  if (!body) throw new Error('Presenter launch unavailable');
  const previous = presenterLaunchFrames.get(host);
  if (previous) { host.clearTimeout(previous.timer); previous.frame.remove(); }
  const frame = host.document.createElement('iframe');
  frame.hidden = true; frame.tabIndex = -1; frame.referrerPolicy = 'no-referrer';
  frame.setAttribute('aria-hidden', 'true'); frame.src = url;
  body.appendChild(frame);
  const timer = host.setTimeout(() => {
    frame.remove();
    if (presenterLaunchFrames.get(host)?.frame === frame) presenterLaunchFrames.delete(host);
  }, 30000);
  presenterLaunchFrames.set(host, {frame, timer});
}
export type HelperPowerPointBridge = PowerPointBridge & {
  version: 2;
  pair(): Promise<{code:string;expiresAt:number}>;
  connection(): Promise<{connected:boolean;ready:boolean;browserControl:boolean}>;
  connectBrowser(): Promise<NativeControlledPresentation>;
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
    const duration=method==='prepare'||method==='start'||method==='connectBrowser'?180000:method==='status'?5000:method==='step'?Math.max(1,Math.min(3000,(args.expiresAt as number)-Date.now())):15000;
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
          if(disposed || generation!==epoch || state.error || state.result?.error)throw Object.assign(new Error('Presentation helper operation not confirmed'), {code: state.result?.error === 'WINDOW_SLIDES_FOREGROUND' ? 'WINDOW_SLIDES_FOREGROUND' : nativePresentationErrorCode(state.result?.error) || (state.error === 'HELPER_OPERATION_EXPIRED' ? 'POWERPOINT_TIMEOUT' : 'POWERPOINT_UNAVAILABLE')});
          return state.result;
        }
        await new Promise(resolve=>setTimeout(resolve,200));
      }
      throw Object.assign(new Error('Presentation helper operation timed out; effect is uncertain'),{code:'POWERPOINT_TIMEOUT'});
    } finally {busy=false;}
  }
  return {
    version:2,
    async pair(){if(disposed)throw new Error('Presentation helper disposed');const value=await post({action:'pair'});pairingId=value.pairingId;if(disposed&&pairingId)void post({action:'disconnect'},5000).catch(()=>undefined);return {code:value.code,expiresAt:value.expiresAt};},
    async connection(){if(disposed)return {connected:false,ready:false,browserControl:false};const value=await post({action:'state'},5000);if(!pairingId)pairingId=value.pairingId;return {connected:value.connected===true,ready:value.ready===true,browserControl:value.browserControl===true};},
    prepare:value=>rpc('prepare',value || {}) as Promise<PreparedPresentation|null>,
    start:value=>rpc('start',value) as Promise<NativeControlledPresentation>,
    step:value=>rpc('step',value) as Promise<{commandId:string;status:NativeControlledPresentation}>,
    connect:()=>rpc('connect') as Promise<NativeControlledPresentation>,
    connectBrowser:()=>rpc('connectBrowser') as Promise<NativeControlledPresentation>,
    status:id=>rpc('status',{id}) as Promise<NativeControlledPresentation>,
    async goTo(){throw new Error('Helper requires animation-step navigation');},
    async disconnect(id){await rpc('disconnect',{id});},
    dispose(){
      if(disposed)return;disposed=true;generation++;
      controllers.forEach(controller=>controller.abort());
      if(pairingId)void post({action:'disconnect'},5000).catch(()=>undefined);
    },
  };
}
