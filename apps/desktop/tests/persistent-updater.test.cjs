'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{EventEmitter}=require('node:events');
const target=path.join(__dirname,'../src/persistent-updater.cjs');
function api(){assert.ok(fs.existsSync(target),'persistent updater launch bridge required');return require(target);}
test('missing updater falls back without any child process',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'persistent-client-'));try{
  assert.equal(await api().launchPersistentUpdater({localAppData:dir,platform:'win32',spawn:()=>{throw Error('must not spawn');}}),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('registered launcher starts with fixed PowerShell and does not quit the client',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'persistent-client-'));try{
  const root=path.join(dir,'CastLinkUpdater');fs.mkdirSync(root);fs.writeFileSync(path.join(root,'castlink-updater.ps1'),'fixture');fs.writeFileSync(path.join(root,'registration.json'),'{}');
  let invocation;
  const spawn=(...args)=>{invocation=args;const child=new EventEmitter();child.unref=()=>{};queueMicrotask(()=>child.emit('spawn'));return child;};
  assert.equal(await api().launchPersistentUpdater({localAppData:dir,platform:'win32',windowsRoot:'C:\\Windows',locale:'en',spawn}),true);
  assert.equal(invocation[0],'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  const script=Buffer.from(invocation[1].at(-1),'base64').toString('utf16le');
  assert.ok(script.includes("-Language 'en'"));assert.ok(script.includes('bootstrapSha256'));assert.ok(script.includes('Get-Acl'));assert.ok(script.includes('ReparsePoint'));
  assert.equal(invocation[2].shell,undefined);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('incomplete registration and invalid language fail without launching',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'persistent-client-'));try{
  const root=path.join(dir,'CastLinkUpdater');fs.mkdirSync(root);fs.writeFileSync(path.join(root,'registration.json'),'{}');
  await assert.rejects(api().launchPersistentUpdater({localAppData:dir,platform:'win32'}),/registration/i);
  assert.throws(()=>api().launchScript('en;throw 1'),/language/i);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('integrity guard throws before executing a modified launcher; presentation is outside the guard',()=>{
 assert.ok(!api().launchScript('en').includes('MessageBox'),'guard must be testable without a modal dialog');
});
test('Windows native bridge executes only the registered private bootstrap and rejects changed bytes/owner/ACL',{skip:process.platform!=='win32'},()=>{
 const {spawnSync}=require('node:child_process');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-bridge-proof-')),root=path.join(dir,'CastLinkUpdater'),marker=path.join(root,'launched.txt');
 const exe=path.win32.join(process.env.WINDIR,'System32','WindowsPowerShell','v1.0','powershell.exe');
 const run=code=>spawnSync(exe,['-NoLogo','-NoProfile','-STA','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],{env:{...process.env,LOCALAPPDATA:dir},encoding:'utf8',timeout:15000});
 try{
  fs.mkdirSync(root);fs.writeFileSync(path.join(root,'castlink-updater.ps1'),"\ufeffparam([string]$Language)\n[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'launched.txt'),$Language)\n");
  const setup=run(`$ErrorActionPreference='Stop';$root=Join-Path $env:LOCALAPPDATA 'CastLinkUpdater';$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User;$acl=[Security.AccessControl.DirectorySecurity]::new();$acl.SetOwner($sid);$acl.SetAccessRuleProtection($true,$false);$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'));Set-Acl -LiteralPath $root -AclObject $acl;$entry=Join-Path $root 'castlink-updater.ps1';@{schemaVersion=1;ownerSid=$sid.Value;bootstrapSha256=(Get-FileHash -LiteralPath $entry -Algorithm SHA256).Hash.ToLowerInvariant()}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'registration.json') -Encoding UTF8;foreach($p in @($entry,(Join-Path $root 'registration.json'))){$a=Get-Acl -LiteralPath $p;$a.SetOwner($sid);Set-Acl -LiteralPath $p -AclObject $a}`);
  assert.equal(setup.status,0,setup.stderr);
  let r=run(api().launchScript('en'));assert.equal(r.status,0,r.stderr);assert.equal(fs.readFileSync(marker,'utf8'),'en');fs.unlinkSync(marker);
  const entry=path.join(root,'castlink-updater.ps1'),bytes=fs.readFileSync(entry);fs.appendFileSync(entry,'#changed');r=run(api().launchScript('en'));assert.notEqual(r.status,0);assert.equal(fs.existsSync(marker),false);fs.writeFileSync(entry,bytes);
  const receipt=path.join(root,'registration.json'),raw=fs.readFileSync(receipt);const registration=JSON.parse(raw.toString('utf8').replace(/^\ufeff/,''));fs.writeFileSync(receipt,JSON.stringify({...registration,ownerSid:'S-1-5-18'}));r=run(api().launchScript('en'));assert.notEqual(r.status,0);assert.equal(fs.existsSync(marker),false);fs.writeFileSync(receipt,raw);
  r=run("$p=Join-Path $env:LOCALAPPDATA 'CastLinkUpdater';$a=Get-Acl -LiteralPath $p;$a.SetAccessRuleProtection($false,$true);([IO.DirectoryInfo]::new($p)).SetAccessControl($a)");assert.equal(r.status,0,r.stderr);
  r=run(api().launchScript('en'));assert.notEqual(r.status,0);assert.equal(fs.existsSync(marker),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
