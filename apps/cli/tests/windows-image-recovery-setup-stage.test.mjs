import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {executeSetup} from '../dist/steps.js';
import {CliError} from '../dist/types.js';
const ids=['preflight','runtime','release','config','services','migrations','seed','owner','verify'];
const fixed='Own pinned Caddy cache completion is unverified; retain its image lease, cursor and private recovery evidence.';
async function execute(message){
 const request={profile:'local-fixture',target:{kind:'local'},network:'loopback',root:'D:\\private\\bundle',release:'0.0.0-windows-local-preview.1'},plan={schemaVersion:1,request,steps:ids,blockers:[]},options={journalDirectory:'D:\\private\\journal'};
 let recoveryCalls=0,cursorCalls=0;
 class SetupExecutionError extends CliError{}class WindowsSetupInitializationError extends CliError{}class TargetOperationObservationError extends CliError{}
 const bindings={ids,isDeepStrictEqual,SetupExecutionError,WindowsSetupInitializationError,TargetOperationObservationError,validateRequest:()=>{},path:path.win32,FileJournal:class{async read(){return{steps:{preflight:'verified',release:'verified',config:'verified',runtime:'pending',services:'pending',migrations:'pending',seed:'pending',owner:'pending',verify:'pending'}}}},exists:async()=>false,recoverPreparedWindowsImageCache:async()=>{recoveryCalls++;throw new CliError(message,4)},openSetupTargetCursor:async()=>{cursorCalls++;assert.fail('refused recovery may not open or replay target cursor')},CliError};
 const fn=new Function('process','structuredClone',...Object.keys(bindings),'return ('+executeSetup.toString()+')')({platform:'win32'},structuredClone,...Object.values(bindings));
 let error;try{await fn(plan,{}, {load:async()=>({request,secretFilePaths:{journal:'D:\\private\\journal\\journal.json'}})},options)}catch(e){error=e}
 return{error,recoveryCalls,cursorCalls};
}
test('actual executeSetup caller preserves fixed recovery refusal and finite worker stage through the existing trusted stage boundary',async()=>{
 for(const message of [fixed,fixed+'\n{"schemaVersion":1,"imageRecoveryStage":1}',fixed+'\n{"schemaVersion":1,"imageRecoveryStage":15}']){const t=await execute(message);assert(t.error instanceof CliError);assert.equal(t.error.message,message);assert.equal(t.error.code,4);assert.equal(t.recoveryCalls,1);assert.equal(t.cursorCalls,0);}
});
