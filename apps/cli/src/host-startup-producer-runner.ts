import {produceHostController,type HostProducerResult} from './host-startup-producer.js';
import type {SetupTargetCursor} from './setup-target-guard.js';
import type {SetupVerificationRequest} from './setup-verification.js';
// Local packaged POSIX-target adapter. Remote bootstrap must supply the bundled
// target runtime/helper before adding a corresponding fixed SSH adapter.
export async function publishHostControllerFromCursor(cursor:SetupTargetCursor,completion:SetupVerificationRequest):Promise<HostProducerResult>{
 if(cursor.remote||cursor.readOnly)throw Error('host-producer-target-runtime-unavailable');
 const binding=structuredClone(cursor.binding);
 if(typeof binding.principal!=='number')throw Error('host-producer-target-runtime-unavailable');
 const generation={...binding,principal:binding.principal};
 return cursor.effect(async()=>{
  const result=await produceHostController({schemaVersion:1,generation,completion:structuredClone(completion)});
  if(result.generation.epoch!==generation.epoch+1||result.generation.engine!==generation.engine||result.generation.endpoint!==generation.endpoint||result.generation.principal!==generation.principal||result.generation.scope!==generation.scope)throw Error('host-producer-generation-unverified');
  return result;
 });
}
