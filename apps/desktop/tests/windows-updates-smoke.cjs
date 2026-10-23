'use strict';
// Genuine native dialogs, isolated profile, fixture metadata. Never installs or connects.
const {app,BrowserWindow,dialog,ipcMain,nativeTheme}=require('electron');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const updates=require('../src/updates.cjs');
const output=process.env.CASTLINK_UPDATE_QA_OUTPUT||path.resolve(__dirname,'../../..','backups','desktop-update-ui-qa');fs.mkdirSync(output,{recursive:true});
const profile=fs.mkdtempSync(path.join(output,'profile-'));app.setPath('userData',profile);app.setName('CastLink Update QA');
let owner,sequence=0,locale='en',downloads=0,installs=0,cleanups=0,wizards=0;const report={electron:process.versions.electron,dialogs:[],checks:[]};
const timeout=setTimeout(()=>{report.error='Native dialog QA timed out';fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));app.exit(1);},90000);timeout.unref();
function release(track='client'){
 const version='1.0.1',commit='b'.repeat(12),tag=`${track}-v${version}-${commit}`;
 const names=track==='client'?[`CastLink-Client-${version}-${commit}-setup.exe`,'SHA256SUMS']:['CastLink-Windows.zip','CastLink-Linux.tar.gz','CastLink-Provisioning.json','manifest.json','SHA256SUMS','CastLink-ThirdParty-Sources.tar.gz','CastLink-ThirdParty-Office-Sources.tar.gz'];
 return {tag_name:tag,published_at:'2026-10-21T00:00:00Z',draft:false,assets:names.map(name=>({name,state:'uploaded',size:128,browser_download_url:`https://github.com/resokol/castlink-releases/releases/download/${tag}/${name}`}))};
}
let choices=[];
async function showMessage(options){
 const plan=choices.shift();assert.ok(plan,'every native dialog has an explicit QA choice');
 const title='CastLink QA Updates '+(++sequence),screenshot=path.join(output,`${String(sequence).padStart(2,'0')}-${plan.name}.png`);
 const args=['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'fixtures/update-dialog-driver.ps1'),'-OwnerProcess',String(process.pid),'-Title',title,'-Screenshot',screenshot,'-Choice',options.buttons[plan.response]];if(plan.toggle)args.push('-Toggle');if(options.buttons.length===1)args.push('-SingleButton');
 const driver=spawn(path.win32.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),args,{windowsHide:true,stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='';driver.stdout.on('data',chunk=>stdout+=chunk);driver.stderr.on('data',chunk=>stderr+=chunk);
 const automation=new Promise((resolve,reject)=>{driver.once('error',reject);driver.once('exit',code=>{fs.writeFileSync(path.join(output,`driver-${sequence}.json`),JSON.stringify({code,stdout,stderr}));if(code===0)resolve();else{report.error=stderr||stdout||'QA driver failed';fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));app.exit(1);reject(Error(report.error));}});});
 const answer=await dialog.showMessageBox(owner,{...options,title});await automation;assert.equal(answer.response,plan.response);
 if(plan.toggle)assert.equal(answer.checkboxChecked,true);
 report.dialogs.push({name:plan.name,locale,theme:nativeTheme.themeSource,answer,screenshot,content:options});return answer;
}
function controller(extra={}){const userData=fs.mkdtempSync(path.join(profile,'case-'));return updates.createUpdateController({userData,current:{track:'client',version:'1.0.0'},getLocale:()=>locale,showMessage,fetchReleases:async()=>[release()],download:async()=>{downloads++;return {file:'verified-fixture-setup.exe',cleanup:()=>cleanups++};},install:async()=>installs++,updateServer:async()=>wizards++,...extra});}
app.whenReady().then(async()=>{try{
 owner=new BrowserWindow({width:1000,height:780,title:'CastLink Update QA',backgroundColor:'#111315',webPreferences:{preload:path.resolve(__dirname,'../src/preload.cjs'),additionalArguments:['--castlink-role=launcher'],contextIsolation:true,sandbox:true,nodeIntegration:false}});owner.setMenu(null);
 ipcMain.handle('castlink:settings',()=>({locale:'en',serverOrigin:'https://fixture.example',reserveOrigins:[],version:'1.0.0 QA'}));ipcMain.handle('castlink:connect',()=>{throw Error('QA cannot connect');});ipcMain.handle('castlink:setup',()=>{throw Error('QA cannot open setup');});
 void owner.loadFile(path.resolve(__dirname,'../ui/start.html')).catch(error=>report.launcherError=error.message);nativeTheme.themeSource='dark';
 await new Promise(resolve=>setTimeout(resolve,500));
 const declined=controller();choices=[{response:0,toggle:true,name:'decline-disable'}];await declined.check();assert.equal(declined.automatic(),false);await declined.check();assert.equal(downloads,0);report.checks.push('native decline plus persisted checkbox; disabled startup check is silent');
 choices=[{response:1,name:'client-update'},{response:0,name:'restart-cancel'}];await declined.check({manual:true});assert.equal(downloads,1);assert.equal(cleanups,1);assert.equal(installs,0);report.checks.push('native manual check bypasses disable; cancel installation leaves app open');
 nativeTheme.themeSource='light';locale='ru';choices=[{response:1,name:'ru-client-update'},{response:1,name:'ru-install-consent'}];await controller().check();assert.equal(installs,1);assert.equal(owner.isDestroyed(),false);report.checks.push('native install consent reaches isolated installer callback only');
 locale='zh-CN';choices=[{response:0,name:'zh-server-stay'}];await controller({fetchReleases:async()=>[release('server-setup')],getServers:async()=>[{track:'server-setup',version:'1.0.0',folder:'C:\\QA\\Saved Server'}]}).check();assert.equal(wizards,0);
 locale='en';choices=[{response:1,name:'server-update'}];await controller({fetchReleases:async()=>[release('server-setup')],getServers:async()=>[{track:'server-setup',version:'1.0.0',folder:'C:\\QA\\Saved Server'}]}).check();assert.equal(wizards,1);report.checks.push('separate native server choices never download the client');
 choices=[{response:0,name:'up-to-date'}];await controller({fetchReleases:async()=>[]}).check({manual:true});
 choices=[{response:0,name:'offline-error'}];await controller({fetchReleases:async()=>{throw Error('private network error');}}).check({manual:true});
 assert.equal(choices.length,0);report.result='PASS';fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({result:'PASS',dialogs:report.dialogs.length,output,checks:report.checks}));owner.destroy();app.exit(0);
 }catch(error){report.result='FAIL';report.error=error.stack;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.error(error.stack);app.exit(1);}});
