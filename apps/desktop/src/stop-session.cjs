'use strict';
function createStopSession({paint,sendStop,notify,register,unregister}) {
  let current,registered=false,timer;
  const retired=new Set();
  function render(){if(current)paint({...current});}
  function retire(id){retired.add(id);if(retired.size>512)retired.delete(retired.values().next().value);}
  function reset(){
    clearTimeout(timer);timer=undefined;
    if(current){retire(current.captureId);paint({...current,sharing:false,visible:false});notify({captureId:current.captureId,state:'closed'});}
    current=undefined;if(registered)unregister();registered=false;
  }
  return {
    update(state){
      if(retired.has(state.captureId))return false;
      if(!state.sharing){if(current?.captureId===state.captureId)reset();else retire(state.captureId);return true;}
      if(current&&current.captureId!==state.captureId)reset();
      if(!current){registered=register();}
      clearTimeout(timer);timer=undefined;
      current={...state,shortcutAvailable:registered};render();return true;
    },
    stop(){
      if(!current||current.stopping)return;
      current={...current,stopping:true,failed:false};render();
      const id=current.captureId;sendStop(id);
      timer=setTimeout(()=>{if(current?.captureId===id){current={...current,stopping:false,failed:true};render();}},8000);timer.unref?.();
    },
    hide(){if(current){current={...current,visible:false};render();notify({captureId:current.captureId,state:'closed'});}},
    reset,
  };
}
module.exports={createStopSession};
