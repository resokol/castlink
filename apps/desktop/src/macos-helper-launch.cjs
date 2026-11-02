'use strict';
const path=require('node:path');
const {spawn:spawnProcess}=require('node:child_process');
const {isRemoteLaunch,parseRemoteLaunch}=require('./remote-pc-protocol.cjs');
const {isPresenterLaunch,parsePresenterLaunch}=require('./presenter-protocol.cjs');
// Only main supplies executable/appPath. URI is data, validated before spawning;
// the helper still consumes its ticket and requires local consent independently.
function createMacHelperLauncher({executable,appPath,spawn=spawnProcess}){
 if(typeof executable!=='string'||!path.isAbsolute(executable)||executable.includes('\0')||appPath!==undefined&&(typeof appPath!=='string'||!path.isAbsolute(appPath)||appPath.includes('\0')))throw Error('Invalid local component path');
 return async value=>{
  if(isRemoteLaunch(value))parseRemoteLaunch(value,{scheme:'castlink-remote:'});
  else if(isPresenterLaunch(value))parsePresenterLaunch(value);
  else return false;
  return new Promise((resolve,reject)=>{
   let child;
   try{child=spawn(executable,[...(appPath?[appPath]:[]),value],{shell:false,detached:true,stdio:'ignore'});}catch{reject(Error('Could not open local component'));return;}
   child.once('error',()=>reject(Error('Could not open local component')));
   child.once('spawn',()=>{child.unref();resolve(true);});
  });
 };
}
module.exports={createMacHelperLauncher};
