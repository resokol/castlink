'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
function buildWindowSlides(root,output){
 if(process.platform!=='win32')throw Error('Build Windows PDF navigation on Windows');
 const compiler=path.win32.join(process.env.SystemRoot||'C:\\Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe');
 if(!fs.existsSync(compiler))throw Error('Windows .NET Framework x64 compiler unavailable');
 fs.mkdirSync(path.dirname(output),{recursive:true});
 execFileSync(compiler,['/nologo','/codepage:65001','/target:exe','/platform:x64','/optimize+','/warnaserror+','/reference:System.Web.Extensions.dll','/out:'+output,path.join(root,'native/windows-window-slides/WindowSlides.cs')],{stdio:'pipe',windowsHide:true});
 return output;
}
module.exports={buildWindowSlides};
if(require.main===module)try{if(!process.argv[2])throw Error('Explicit output path required');buildWindowSlides(path.resolve(__dirname,'../../..'),path.resolve(process.argv[2]));}catch{console.error('Windows PDF navigation build failed');process.exitCode=1;}
