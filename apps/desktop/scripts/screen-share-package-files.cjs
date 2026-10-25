'use strict';
const fs=require('node:fs'),path=require('node:path');
const {readManifest}=require('../../../scripts/release-track.cjs');
// Deliberately closed: adding a full-client module never adds it to this product.
const PACKAGE_FILES=Object.freeze([
 'src/screen-share-main.cjs',
 'src/remote-pc-helper.cjs','src/remote-pc-protocol.cjs','src/remote-pc-capture.cjs',
 'src/remote-pc-session.cjs','src/remote-pc-input.cjs','src/remote-pc-input-gate.cjs',
 'src/remote-pc-picker-preload.cjs','src/remote-pc-publisher-preload.cjs','src/process-audio.cjs',
 'ui/capture-picker.html','ui/capture-picker.css','ui/capture-picker.js','ui/start.css',
 'assets/castlink-icon.svg','assets/castlink-icon.ico',
]);
function stageScreenShare(root,destination,sourceCommit){
 if(!/^[a-f0-9]{40}$/.test(sourceCommit))throw Error('Exact source commit required');
 if(fs.existsSync(destination)&&fs.readdirSync(destination).length)throw Error('Component stage must be empty');
 const desktop=path.join(root,'apps/desktop'),manifest=JSON.parse(fs.readFileSync(path.join(desktop,'package.json'),'utf8'));
 // Share the current product version, without adopting the client update track.
 const version=readManifest(root).tracks.client.version;
 fs.mkdirSync(destination,{recursive:true});
 for(const relative of PACKAGE_FILES){const source=path.join(desktop,relative);if(!fs.lstatSync(source).isFile())throw Error('Invalid component source');fs.mkdirSync(path.dirname(path.join(destination,relative)),{recursive:true});fs.copyFileSync(source,path.join(destination,relative));}
 fs.writeFileSync(path.join(destination,'package.json'),JSON.stringify({name:'castlink-screen-share',version,main:'src/screen-share-main.cjs',author:'CastLink',description:'CastLink on-demand screen sharing component',license:'MIT'},null,2)+'\n');
 for(const file of ['LICENSE','THIRD_PARTY_NOTICES'])fs.copyFileSync(path.join(root,file),path.join(destination,file));
 const info={schemaVersion:1,component:'screen-share',track:'screen-share',version,buildNumber:version+'-'+sourceCommit.slice(0,12),sourceCommit,electron:manifest.devDependencies.electron,systemAudio:false,presentationAudio:'powerpoint-process-only',remotePcCapture:1,remotePcInput:1,serverSetup:false,updateChecks:false,manualUpdate:false,autoUpdate:false,testBuild:false,signed:false};
 fs.writeFileSync(path.join(destination,'build-info.json'),JSON.stringify(info,null,2)+'\n');return info;
}
module.exports={PACKAGE_FILES,stageScreenShare};
