'use strict';
const fs=require('node:fs'),path=require('node:path');
const TRACKS=Object.freeze(['client','server-setup','linux']);
const VERSION=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?$/;
function readManifest(root=path.resolve(__dirname,'..')){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'distribution/release-tracks.json'),'utf8'));
  if(manifest.schemaVersion!==1||manifest.repository!=='resokol/castlink-releases'||JSON.stringify(Object.keys(manifest.tracks).sort())!==JSON.stringify([...TRACKS].sort()))throw Error('Invalid release tracks manifest');
  for(const track of TRACKS){const info=manifest.tracks[track];if(!VERSION.test(info.version)||info.branch!=='main'||info.tagPrefix!==`${track}-v`)throw Error(`Invalid release track: ${track}`);}
  return manifest;
}
function resolveTrack(track,sourceCommit,root){
  if(!TRACKS.includes(track))throw Error('Select client, server-setup, or linux');
  if(!/^[a-f0-9]{40}$/.test(sourceCommit??''))throw Error('Exact source commit required');
  const manifest=readManifest(root),info=manifest.tracks[track];
  return {schemaVersion:1,track,version:info.version,buildNumber:`${info.version}-${sourceCommit.slice(0,12)}`,sourceCommit,branch:info.branch,tag:`${info.tagPrefix}${info.version}-${sourceCommit.slice(0,12)}`,repository:manifest.repository};
}
function setVersion(track,version,root=path.resolve(__dirname,'..')){
  const manifest=readManifest(root);
  if(!TRACKS.includes(track)||!VERSION.test(version??''))throw Error('Select a track and a valid version');
  manifest.tracks[track].version=version;
  fs.writeFileSync(path.join(root,'distribution/release-tracks.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest.tracks[track];
}
function assertSource(info,ref){if(ref!=='refs/heads/main')throw Error(`Release ${info.track} from main`);}
module.exports={TRACKS,VERSION,readManifest,resolveTrack,setVersion,assertSource};
if(require.main===module){
  const [command,track,value]=process.argv.slice(2);
  if(command==='set-version')console.log(JSON.stringify(setVersion(track,value)));
  else if(command==='metadata'){
    const info=resolveTrack(track,value);if(process.env.GITHUB_REF)assertSource(info,process.env.GITHUB_REF);
    console.log(JSON.stringify(info));
    if(process.env.GITHUB_OUTPUT)for(const key of ['track','version','buildNumber','tag','repository'])fs.appendFileSync(process.env.GITHUB_OUTPUT,`${key}=${info[key]}\n`);
  }else throw Error('Usage: release-track.cjs metadata <track> <commit> | set-version <track> <version>');
}
