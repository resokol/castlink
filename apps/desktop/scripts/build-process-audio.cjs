'use strict';
const fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
function buildProcessAudio(root,output){
  if(process.platform!=='win32')throw Error('Build PowerPoint process audio on Windows');
  const compiler=path.win32.join(process.env.SystemRoot||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe');
  if(!fs.existsSync(compiler))throw Error('Windows .NET Framework x64 compiler unavailable');
  const source=path.join(root,'native','windows-process-audio','ProcessAudio.cs');
  fs.mkdirSync(path.dirname(output),{recursive:true});
  execFileSync(compiler,['/nologo','/codepage:65001','/target:exe','/platform:x64','/optimize+','/warnaserror+', '/out:'+output,source],{stdio:'pipe',windowsHide:true});
  if(!fs.existsSync(output))throw Error('PowerPoint process audio helper was not built');
  return output;
}
module.exports={buildProcessAudio};
if(require.main===module){
  try{
    const root=path.resolve(__dirname,'../../..'),output=process.argv[2];
    if(!output)throw Error('Explicit output path required');
    buildProcessAudio(root,path.resolve(output));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
