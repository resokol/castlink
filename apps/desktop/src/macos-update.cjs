'use strict';
const fs=require('node:fs'),path=require('node:path');
const DMG=/^CastLink-Client-(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?-[a-f0-9]{12}-mac-(arm64|x64)\.dmg$/;
// This opens a checksum-verified download after the updater's second consent.
// It never replaces the running app, changes userData, or asks the app to quit.
async function launchInstaller(file,{platform=process.platform,arch=process.arch,spawn=require('node:child_process').spawn}={}){
  if(platform!=='darwin'||!['arm64','x64'].includes(arch)||typeof file!=='string'||!path.isAbsolute(file)||DMG.exec(path.basename(file))?.[1]!==arch)throw Error('Installer unavailable');
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||!stat.size)throw Error('Installer unavailable');
  return new Promise((resolve,reject)=>{
    let child;
    try{child=spawn('/usr/bin/open',[file],{shell:false,stdio:'ignore'});}catch{reject(Error('Installer could not open'));return;}
    child.once('error',()=>reject(Error('Installer could not open')));
    // A successful open request is not evidence of a completed installation.
    child.once('close',code=>code===0?resolve({started:true,installed:false}):reject(Error('Installer could not open')));
  });
}
module.exports={launchInstaller};
