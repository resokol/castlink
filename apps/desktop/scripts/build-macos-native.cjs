'use strict';
const fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
function buildMacNative({root,resourcesPath,arch,platform=process.platform,hostArch=process.arch,run=execFileSync}){
 if(platform!=='darwin'||!['arm64','x64'].includes(arch)||arch!==hostArch)throw Error('Native macOS host matching target architecture required');
 if(!path.isAbsolute(root)||!path.isAbsolute(resourcesPath))throw Error('Absolute source and resource paths required');
 const specs=[
  ['audio',['macos-common/ProcessBirth.swift','macos-process-audio/ProcessAudio.swift'],'process-audio/CastLink.ProcessAudio'],
  ['input',['macos-common/ProcessBirth.swift','macos-remote-input/Core.swift','macos-remote-input/RemoteInput.swift'],'remote-input/CastLink.RemoteInput'],
  ['slides',['macos-common/ProcessBirth.swift','macos-presentation/WindowSlides.swift'],'window-slides/CastLink.WindowSlides'],
  ['powerpoint',['macos-common/ProcessBirth.swift','macos-presentation/PowerPointIdentity.swift'],'powerpoint/CastLink.PowerPointIdentity'],
 ];
 const result={},failures=[];
 for(const [name,relative,dest]of specs){
  try{
  const sources=relative.map(file=>path.join(root,'native',file));
  for(const file of sources)if(!fs.lstatSync(file).isFile())throw Error('Native source must be a regular file');
  const out=path.join(resourcesPath,dest);fs.mkdirSync(path.dirname(out),{recursive:true});
  run('/usr/bin/xcrun',['swiftc','-swift-version','5','-O','-parse-as-library','-target',`${arch==='x64'?'x86_64':arch}-apple-macos13.0`,...sources,'-o',out],{shell:false,encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});
  if(!fs.lstatSync(out).isFile())throw Error('Native compiler did not produce helper');
  fs.chmodSync(out,0o755);result[name]=out;
  }catch(error){failures.push(`${name}: ${String(error.message).slice(0,30000)}`);}
 }
 if(failures.length){const error=Error('macOS native compilation failed:\n'+failures.join('\n\n'));error.helpers=result;throw error;}
 return result;
}
module.exports={buildMacNative};
if(require.main===module){
 const [arch,destination]=process.argv.slice(2);
 try{console.log(JSON.stringify(buildMacNative({root:path.resolve(__dirname,'../../..'),resourcesPath:path.resolve(destination||'artifacts/desktop-native'),arch})));}catch(error){console.error(error.message);process.exitCode=1;}
}
