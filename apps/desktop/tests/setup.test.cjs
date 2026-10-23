'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events');
const {createSetupAdapter}=require('../src/setup.cjs');

function fixture(t,options={}){
  const resourcesPath=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-setup-'));
  t.after(()=>fs.rmSync(resourcesPath,{recursive:true,force:true}));
  const script=path.join(resourcesPath,'setup','scripts','simple-easy-setup-gui.ps1');
  fs.mkdirSync(path.dirname(script),{recursive:true});fs.writeFileSync(script,'fixture');
  const launches=[],children=[];
  const adapter=createSetupAdapter({resourcesPath,platform:'win32',windowsDirectory:'C:\\Windows',spawn:(...args)=>{
    launches.push(args);const child=new EventEmitter();child.unref=()=>{child.unreferenced=true;};children.push(child);return child;
  },...options});
  return {adapter,launches,children,script};
}
test('setup starts only the packaged WPF entry with explicit action and locale',async t=>{
  const f=fixture(t);const pending=f.adapter.launch('update','zh-CN');
  assert.equal(f.launches.length,1);
  const [executable,args,options]=f.launches[0];
  assert.equal(executable,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  assert.deepEqual(args,['-NoProfile','-STA','-WindowStyle','Hidden','-ExecutionPolicy','Bypass','-File',f.script,'-Action','update','-Language','zh-CN']);
  assert.equal(options.shell,false);assert.equal(options.stdio,'ignore');
  assert.equal(options.detached,false,'the existing Framework Docker worker requires a real console');
  assert.equal(options.windowsHide,false,'PowerShell hides its console via -WindowStyle rather than CREATE_NO_WINDOW');
  assert.equal(options.cwd,path.dirname(path.dirname(f.script)));
  f.children[0].emit('spawn');assert.deepEqual(await pending,{started:true});assert.equal(f.children[0].unreferenced,true);
});
test('setup refuses unrecognized actions and locales before starting a process',async t=>{
  const f=fixture(t);
  for(const action of ['choose','connect','install; Remove-Item','../remove',{},null])await assert.rejects(f.adapter.launch(action,'ru'),/Invalid setup action/);
  await assert.rejects(f.adapter.launch('install','ru -Command evil'),/Invalid setup language/);
  assert.equal(f.launches.length,0);
});
test('setup holds one wizard until exit and clears a failed launch for retry',async t=>{
  const f=fixture(t);let pending=f.adapter.launch('install','en');f.children[0].emit('error',Error('ENOENT'));
  await assert.rejects(pending,/Could not start setup wizard/);
  pending=f.adapter.launch('remove','ru');f.children[1].emit('spawn');await pending;
  await assert.rejects(f.adapter.launch('install','ru'),/already open/);
  f.children[1].emit('exit',0);pending=f.adapter.launch('update','ru');f.children[2].emit('spawn');await pending;
  assert.equal(f.launches.length,3);
});
test('setup fails without packaged resources or on another platform',async t=>{
  const f=fixture(t);fs.unlinkSync(f.script);await assert.rejects(f.adapter.launch('install','ru'),/unavailable/);assert.equal(f.launches.length,0);
  const other=fixture(t,{platform:'linux'});await assert.rejects(other.adapter.launch('install','ru'),/Windows/);assert.equal(other.launches.length,0);
});

test('notification update forwards only an absolute saved installation folder as a separate wizard argument',async t=>{
  const f=fixture(t),folder=path.join(path.dirname(f.script),'Saved Server With Spaces');
  const pending=f.adapter.launch('update','en',folder);assert.deepEqual(f.launches[0][1].slice(-2),['-InstallFolder',folder]);f.children[0].emit('spawn');await pending;
  await assert.rejects(f.adapter.launch('update','en','relative'),/Invalid installation folder/);
  await assert.rejects(f.adapter.launch('install','en',folder),/Invalid installation folder/);
});
