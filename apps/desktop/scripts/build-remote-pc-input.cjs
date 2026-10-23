'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
function buildRemotePcInput(root,output){
 if(process.platform!=='win32')throw Error('Build Windows remote input on Windows');
 const compiler=path.win32.join(process.env.SystemRoot||'C:\\Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe');
 if(!fs.existsSync(compiler))throw Error('Windows .NET Framework x64 compiler unavailable');
 fs.mkdirSync(path.dirname(output),{recursive:true});
 execFileSync(compiler,['/nologo','/codepage:65001','/target:exe','/platform:x64','/optimize+','/warnaserror+','/reference:System.Web.Extensions.dll','/out:'+output,path.join(root,'native/windows-remote-input/RemoteInput.cs')],{stdio:'pipe',windowsHide:true});
 if(!fs.existsSync(output))throw Error('Windows remote input helper was not built');return output;
}
module.exports={buildRemotePcInput};
if(require.main===module)try{if(!process.argv[2])throw Error('Explicit output path required');buildRemotePcInput(path.resolve(__dirname,'../../..'),path.resolve(process.argv[2]));}catch{console.error('Windows remote input build failed');process.exitCode=1;}
