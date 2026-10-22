import type { ScreenShareStopLabels, ScreenShareStopPanelState } from './screen-share-stop-panel';

type DesktopScreenState = {captureId:string;sharing:boolean;visible:boolean;stopping:boolean;failed:boolean;locale:string;labels:Omit<ScreenShareStopLabels,'locale'>};
export type DesktopScreenBridge = {
  update(value:DesktopScreenState):Promise<unknown>;
  onStop(listener:(captureId:string)=>void):()=>void;
  onState(listener:(value:{captureId:string;state:'open'|'closed'})=>void):()=>void;
};
export function desktopScreenBridge(host:unknown):DesktopScreenBridge|undefined {
  try {
    const desktop=(host as {castlinkDesktop?:{version?:number;screenShare?:DesktopScreenBridge}})?.castlinkDesktop;
    const bridge=desktop?.screenShare;
    if(desktop?.version===1&&bridge&&typeof bridge.update==='function'&&typeof bridge.onStop==='function'&&typeof bridge.onState==='function')return bridge;
  } catch {}
}
export function createDesktopStopPanel({bridge,labels:initialLabels,isSharing,stop,onStateChange}:{
  bridge:DesktopScreenBridge;labels:ScreenShareStopLabels;isSharing:()=>boolean;stop:()=>Promise<void>;onStateChange?:(state:ScreenShareStopPanelState)=>void;
}) {
  let labels=initialLabels,captureId:string|undefined,visible=false,suppressed=false,stopping=false,failed=false,disposed=false;
  const hiddenAcks=new Set<object>();
  const state=(value:ScreenShareStopPanelState)=>{if(!disposed)onStateChange?.(value);};
  const id=()=>{if(!captureId)captureId=crypto.randomUUID();return captureId;};
  const snapshot=(sharing:boolean):DesktopScreenState=>({captureId:id(),sharing,visible:sharing&&visible&&!suppressed,stopping,failed,locale:labels.locale,labels:{title:labels.title,stop:labels.stop,stopping:labels.stopping,stopError:labels.stopError}});
  function send(sharing:boolean){
    const value=snapshot(sharing),hiddenAck=sharing&&!value.visible?{}:undefined;
    if(hiddenAck)hiddenAcks.add(hiddenAck);
    return bridge.update(value).catch(()=>{if(hiddenAck)hiddenAcks.delete(hiddenAck);if(!disposed&&captureId===value.captureId){if(!suppressed)visible=false;state('closed');}return false;});
  }
  function sync(){
    if(disposed)return;
    if(!isSharing()){
      if(captureId){void send(false);captureId=undefined;hiddenAcks.clear();}
      visible=false;stopping=false;failed=false;state('closed');
    }else if(captureId)void send(true);
  }
  const removeStop=bridge.onStop(requested=>{
    if(disposed||stopping||requested!==captureId||!isSharing())return;
    const current=captureId;stopping=true;failed=false;void send(true);
    void (async()=>{try{await stop();}catch{if(captureId===current)failed=true;}finally{if(!disposed&&captureId===current){stopping=false;sync();}}})();
  });
  const removeState=bridge.onState(value=>{
    if(disposed||value.captureId!==captureId)return;
    if(value.state==='closed'){
      // Native acknowledges every hidden update, potentially after fallback is restored.
      const expected=hiddenAcks.values().next().value;
      if(expected){hiddenAcks.delete(expected);if(visible)return;}
      if(suppressed&&visible)return;
    }
    visible=value.state==='open';state(value.state);
  });
  return {
    async open(){if(disposed||!isSharing())return false;visible=true;failed=false;state('opening');const current=id();const result=await send(true);if(disposed||captureId!==current||!isSharing())return false;if(result===false){visible=false;state('closed');return false;}state('open');return true;},
    sync,setSuppressed(next:boolean){if(disposed||suppressed===next)return;suppressed=next;if(captureId&&isSharing())void send(true);},setLabels(next:ScreenShareStopLabels){labels=next;if(!disposed&&captureId)void send(isSharing());},
    dispose(){if(disposed)return;if(captureId)void send(false);state('closed');disposed=true;removeStop();removeState();captureId=undefined;hiddenAcks.clear();},
  };
}
