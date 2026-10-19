'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {stagePackage,artifactNames}=require('./package-files.cjs');
async function main(){
  if(process.platform!=='win32')throw Error('Build the Windows client on Windows');
  const root=path.resolve(__dirname,'../../..'),desktop=path.resolve(__dirname,'..');
  const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  if(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim())throw Error('Commit the candidate before packaging so source provenance is exact');
  const stage=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-client-package-'));
  try{
    const info=stagePackage(root,stage,commit),short=commit.slice(0,12),out=path.join(root,'artifacts/desktop',short);
    const names=artifactNames(info.version,commit);
    const {build}=require('electron-builder');
    const files=await build({projectDir:desktop,config:{extends:path.join(desktop,'electron-builder.yml'),directories:{app:stage,output:out},electronVersion:info.electron,artifactName:names.portable,nsis:{artifactName:names.installer}},targets:require('electron-builder').Platform.WINDOWS.createTarget(['zip','nsis'],require('electron-builder').Arch.x64)});
    const hashes=[];
    for(const file of files){if(!/\.(zip|exe)$/.test(file))continue;const bytes=fs.readFileSync(file);hashes.push(`${crypto.createHash('sha256').update(bytes).digest('hex')}  ${path.basename(file)}`);}
    fs.writeFileSync(path.join(out,'SHA256SUMS'),hashes.join('\n')+'\n');fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(info,null,2)+'\n');
    console.log(JSON.stringify({output:out,artifacts:hashes,sourceCommit:commit}));
  }finally{fs.rmSync(stage,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
