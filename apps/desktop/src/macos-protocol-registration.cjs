'use strict';
const fs=require('node:fs'),path=require('node:path');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const SCHEMES=Object.freeze(['castlink','castlink-remote','castlink-presenter','castlink-share']);
const CODES=new Set(['BUNDLE_LOCATION','BUNDLE_IDENTITY','MAIN_EXECUTABLE','REGISTRATION_ARGUMENTS','REGISTRATION_TIMEOUT','REGISTRATION_FAILED','CLAIMS_REGISTRATION_FAILED','SELECTION_MISMATCH']);
const execute=promisify(execFile);
const failed=(code,nativeStatus,nativeDomain)=>({ok:false,code,schemes:[...SCHEMES],selectedPathMatches:false,...(Number.isInteger(nativeStatus)&&nativeStatus>=-2147483648&&nativeStatus<=2147483647?{nativeStatus,nativeDomain:['NSOSStatusErrorDomain','NSCocoaErrorDomain'].includes(nativeDomain)?nativeDomain:'OTHER'}:{})});
function diagnostics(value){
 const clean={};
 if(Number.isInteger(value.claimsStatus)&&value.claimsStatus>=-2147483648&&value.claimsStatus<=2147483647)clean.claimsStatus=value.claimsStatus;
 const states=['candidate','none','unresolved','other-castlink','other-application'],locations=['candidate','none','staged','mounted','temporary','applications','other'];
 if(Array.isArray(value.selection)&&value.selection.length===4&&value.selection.every((entry,i)=>entry&&entry.scheme===SCHEMES[i]&&states.includes(entry.state)&&typeof entry.bundleMatches==='boolean'&&locations.includes(entry.location)))clean.selection=value.selection.map(({scheme,state,bundleMatches,location})=>({scheme,state,bundleMatches,location}));
 return clean;
}
function result(stdout){
 try{
  if(typeof stdout!=='string'||Buffer.byteLength(stdout)>16384)return null;
  const value=JSON.parse(stdout);
  if(value.protocol!==1||JSON.stringify(value.schemes)!==JSON.stringify(SCHEMES)||typeof value.registrationPerformed!=='boolean')return null;
  const selected=diagnostics(value);
  if(value.ok===true&&value.code==='REGISTERED'&&value.selectedPathMatches===true&&value.registrationPerformed===true&&selected.claimsStatus===0&&selected.selection&&selected.selection.every(entry=>entry.state==='candidate'&&entry.bundleMatches&&entry.location==='candidate'))return {ok:true,code:'REGISTERED',schemes:[...SCHEMES],selectedPathMatches:true,...selected};
  if(value.ok===false&&value.selectedPathMatches===false&&CODES.has(value.code))return {...failed(value.code,value.nativeStatus,value.nativeDomain),...selected};
 }catch{}
 return null;
}
async function registerMacProtocols({resourcesPath,executable=process.execPath,platform=process.platform,run=execute}={}){
 if(platform!=='darwin')return failed('UNSUPPORTED_PLATFORM');
 let helper,main;
 try{
  if(typeof resourcesPath!=='string'||!path.isAbsolute(resourcesPath)||typeof executable!=='string'||!path.isAbsolute(executable))return failed('BUNDLE_LOCATION');
  const resources=fs.realpathSync(resourcesPath),contents=path.dirname(resources),bundle=path.dirname(contents);
  if(path.basename(resources)!=='Resources'||path.basename(contents)!=='Contents'||path.extname(bundle)!=='.app')return failed('BUNDLE_LOCATION');
  main=fs.realpathSync(executable);if(path.dirname(main)!==fs.realpathSync(path.join(contents,'MacOS')))return failed('MAIN_EXECUTABLE');
  helper=path.join(resources,'registration/CastLink.ProtocolRegistration');
  if(fs.realpathSync(helper)!==helper||!fs.lstatSync(helper).isFile()||!fs.lstatSync(main).isFile()||(fs.statSync(helper).mode&0o111)===0||(fs.statSync(main).mode&0o111)===0)return failed('BUNDLE_LOCATION');
 }catch{return failed('BUNDLE_LOCATION');}
 try{
  const response=await run(helper,['--register',main],{encoding:'utf8',shell:false,timeout:15000,maxBuffer:16384,killSignal:'SIGKILL',windowsHide:true});
  return result(response.stdout)||failed('REGISTRATION_PROTOCOL');
 }catch(error){
  const native=result(error.stdout);if(native?.ok===false)return native;
  return failed(error.killed||error.signal||error.code==='ETIMEDOUT'?'REGISTRATION_TIMEOUT':'REGISTRATION_UNAVAILABLE');
 }
}
module.exports={SCHEMES,registerMacProtocols};
