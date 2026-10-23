'use strict';
const fs=require('node:fs'),path=require('node:path');
const {resolveTrack}=require('../../../scripts/release-track.cjs');
function isPackageFile(file){return /^(src\/[a-z][a-z0-9-]*\.cjs|ui\/[a-z][a-z0-9-]*\.(html|css|js)|assets\/castlink-icon\.(svg|ico))$/.test(file);}
function artifactNames(version,commit){const prefix=`CastLink-Client-${version}-${commit.slice(0,12)}`;return {unified:`CastLink-${version}-${commit.slice(0,12)}-Windows.exe`,portable:prefix+'-win-x64.${ext}',installer:prefix+'-setup.exe'};}
function stagePackage(root,destination,sourceCommit){
  if(!/^[a-f0-9]{40}$/.test(sourceCommit))throw Error('Exact source commit required');
  const product=resolveTrack('client',sourceCommit,root);
  const desktop=path.join(root,'apps/desktop'),manifest=JSON.parse(fs.readFileSync(path.join(desktop,'package.json'),'utf8'));
  fs.mkdirSync(destination,{recursive:true});
  for(const folder of ['src','ui','assets'])for(const name of fs.readdirSync(path.join(desktop,folder))){
    const relative=`${folder}/${name}`,source=path.join(desktop,relative);
    if(!isPackageFile(relative)||!fs.lstatSync(source).isFile())continue;
    fs.mkdirSync(path.dirname(path.join(destination,relative)),{recursive:true});fs.copyFileSync(source,path.join(destination,relative));
  }
  fs.writeFileSync(path.join(destination,'package.json'),JSON.stringify({name:manifest.name,version:product.version,main:manifest.main,author:'CastLink',description:'CastLink Windows Client',license:'SEE LICENSE IN LICENSE'},null,2));
  for(const file of ['LICENSE','THIRD_PARTY_NOTICES'])fs.copyFileSync(path.join(root,file),path.join(destination,file));
  const info={...product,electron:manifest.devDependencies.electron,systemAudio:false,presentationAudio:'powerpoint-process-only',floatingSlideControls:true,powerPointBridge:4,browserControl:true,serverSetup:true,updateChecks:true,manualUpdate:true,autoUpdate:false,signed:false};
  fs.writeFileSync(path.join(destination,'build-info.json'),JSON.stringify(info,null,2));return info;
}
module.exports={isPackageFile,stagePackage,artifactNames};

