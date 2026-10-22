'use strict';
const stale=()=>Object.assign(new Error('Presentation control has ended.'),{code:'POWERPOINT_STALE'});
function createNativePresentationController({powerPoint,windowSlides}){
 let active,disposed=false,busy=false,generation=0;const prepared=new Map();
 const open=()=>{if(disposed)throw stale();};
 const current=epoch=>{open();if(generation!==epoch)throw stale();};
 const selected=id=>{open();if(!active||id!==active.id)throw stale();return active;};
 async function exclusive(action){open();if(busy)throw Object.assign(Error('Presentation is busy.'),{code:'POWERPOINT_BUSY'});busy=true;const epoch=generation;try{return await action(epoch);}finally{busy=false;}}
 async function accept(controller,status,preparation,epoch){
  try{current(epoch);}catch(error){await controller.disconnect(status.id).catch(()=>{});throw error;}
  const previous=active;active={controller,id:status.id};if(preparation)preparation.startedId=status.id;
  if(previous&&previous.id!==status.id)await previous.controller.disconnect(previous.id).catch(()=>{});
  current(epoch);return status;
 }
 return{
  prepare(value){return exclusive(async epoch=>{
   if(value!==undefined&&(!value||Array.isArray(value)||Object.keys(value).some(k=>k!=='kind')||value.kind!=='window'))throw stale();
   const controller=value?.kind==='window'?windowSlides:powerPoint,result=await controller.prepare();current(epoch);
   if(!result)return null;
   for(const [id,entry]of prepared)if(entry.controller===controller)prepared.delete(id);
   prepared.set(result.preparedId,{controller,kind:result.kind});return result;
  });},
  preparedKind:id=>prepared.get(id)?.kind,
  start(value){return exclusive(async epoch=>{const entry=prepared.get(value?.preparedId);if(!entry)throw stale();return accept(entry.controller,await entry.controller.start(value),entry,epoch);});},
  connect(){return exclusive(async epoch=>accept(powerPoint,await powerPoint.connect(),undefined,epoch));},
  async status(id){return selected(id).controller.status(id);},
  async step(value){return selected(value?.id).controller.step(value);},
  async goTo(value){const owner=selected(value?.id);if(owner.controller===windowSlides)throw stale();return owner.controller.goTo(value);},
  async disconnect(id){const owner=selected(id);active=undefined;generation++;powerPoint.cancelPending?.();windowSlides.cancelPending?.();return owner.controller.disconnect(id);},
  dispose(){if(disposed)return;disposed=true;generation++;active=undefined;prepared.clear();powerPoint.dispose();windowSlides.dispose();},
 };
}
module.exports={createNativePresentationController};
