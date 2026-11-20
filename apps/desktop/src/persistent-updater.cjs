'use strict';
const fs=require('node:fs'),path=require('node:path');
// Fixed code runs ownership/integrity checks before executing the registered bootstrap.
function launchScript(locale='ru'){
 if(!['ru','en','zh-CN'].includes(locale))throw Error('Invalid updater language');
 return `$ErrorActionPreference='Stop'
 $root=Join-Path $env:LOCALAPPDATA 'CastLinkUpdater'
 $entry=Join-Path $root 'castlink-updater.ps1';$receipt=Join-Path $root 'registration.json'
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 $allowed=@($sid,'S-1-5-18','S-1-5-32-544')
 foreach($file in @($root,$entry,$receipt)){
  $item=Get-Item -LiteralPath $file -Force
  if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Updater path is a reparse point'}
  $acl=Get-Acl -LiteralPath $file
  if($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $sid){throw 'Updater owner differs'}
  foreach($rule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){if($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -notin $allowed){throw 'Updater permissions differ'}}
 }
 if(-not (Get-Acl -LiteralPath $root).AreAccessRulesProtected){throw 'Updater directory permissions are inherited'}
 $parent=[IO.Directory]::GetParent($root)
 while($parent){if((Get-Item -LiteralPath $parent.FullName -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Updater ancestor is a reparse point'};$parent=$parent.Parent}
 if((Get-Item -LiteralPath $receipt).Length -gt 65536 -or (Get-Item -LiteralPath $entry).Length -gt 4194304){throw 'Updater registration exceeds bounds'}
 $r=Get-Content -LiteralPath $receipt -Raw -Encoding UTF8|ConvertFrom-Json
 if($r.schemaVersion -ne 1 -or $r.ownerSid -cne $sid -or $r.bootstrapSha256 -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $entry -Algorithm SHA256).Hash.ToLowerInvariant() -cne $r.bootstrapSha256){throw 'Updater registration integrity differs'}
 & $entry -Language '${locale}'
`;
}
async function launchPersistentUpdater({localAppData=process.env.LOCALAPPDATA,windowsRoot=process.env.WINDIR,locale='ru',platform=process.platform,spawn=require('node:child_process').spawn}={}){
 if(platform!=='win32'||!localAppData)return false;
 const root=path.join(localAppData,'CastLinkUpdater'),entry=path.join(root,'castlink-updater.ps1'),receipt=path.join(root,'registration.json');
 const hasEntry=fs.existsSync(entry),hasReceipt=fs.existsSync(receipt);
 if(!hasEntry&&!hasReceipt)return false;
 if(!hasEntry||!hasReceipt)throw Error('Incomplete updater registration');
 if(!windowsRoot||!path.win32.isAbsolute(windowsRoot))throw Error('Windows directory required');
 const script="try {\n"+launchScript(locale)+"\n} catch {Add-Type -AssemblyName PresentationFramework;[Windows.MessageBox]::Show($_.Exception.Message,'CastLink updater','OK','Error')|Out-Null;exit 1}";
 const encoded=Buffer.from(script,'utf16le').toString('base64');
 await new Promise((resolve,reject)=>{
  const child=spawn(path.win32.join(windowsRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoLogo','-NoProfile','-STA','-ExecutionPolicy','Bypass','-EncodedCommand',encoded],{detached:true,windowsHide:true,stdio:'ignore'});
  child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});
 });
 return true;
}
module.exports={launchPersistentUpdater,launchScript};
