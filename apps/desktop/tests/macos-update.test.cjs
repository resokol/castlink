'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {EventEmitter}=require('node:events');
const updates=require('../src/updates.cjs');
const macos=require('../src/macos-update.cjs');
function temporary(){return fs.mkdtempSync(path.join(os.tmpdir(),'castlink update 空间 '));}
function childProcess(){const child=new EventEmitter();child.unref=()=>{};return child;}
test('macOS handoff uses /usr/bin/open with a literal DMG path and reports started without installation or quit',async()=>{
  const directory=temporary();try{
    const file=path.join(directory,'CastLink-Client-1.0.1-aaaaaaaaaaaa-mac-x64.dmg');fs.writeFileSync(file,'verified fixture');
    let child,quit=0;
    const result=updates.launchInstaller(file,{platform:'darwin',arch:'x64',onStarted:()=>quit++,spawn:(command,args,options)=>{
      assert.equal(command,'/usr/bin/open');assert.deepEqual(args,[file]);assert.equal(options.shell,false);child=childProcess();return child;
    }});
    child.emit('spawn');assert.equal(quit,0);child.emit('close',0);
    assert.deepEqual(await result,{started:true,installed:false});assert.equal(quit,0);assert.equal(fs.readFileSync(file,'utf8'),'verified fixture');
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('macOS handoff refuses Windows, other architectures, relative paths, empty files and symlinks before spawning',async()=>{
  const directory=temporary();try{
    const good=path.join(directory,'CastLink-Client-1.0.1-aaaaaaaaaaaa-mac-arm64.dmg');fs.writeFileSync(good,'fixture');
    const empty=path.join(directory,'CastLink-Client-1.0.2-aaaaaaaaaaaa-mac-arm64.dmg');fs.writeFileSync(empty,'');
    const link=path.join(directory,'CastLink-Client-1.0.3-aaaaaaaaaaaa-mac-arm64.dmg');fs.symlinkSync(good,link);
    const options={platform:'darwin',arch:'arm64',spawn:()=>assert.fail('invalid installer must not spawn')};
    for(const file of [good.replace('-arm64.dmg','-x64.dmg'),'client-setup.exe','relative-mac-arm64.dmg',empty,link,path.join(directory,'missing-mac-arm64.dmg')])await assert.rejects(macos.launchInstaller(file,options));
    await assert.rejects(macos.launchInstaller(good,{...options,platform:'win32'}));
    await assert.rejects(macos.launchInstaller(good,{...options,arch:'x64'}));
    await assert.rejects(macos.launchInstaller(good,{...options,arch:'ia32'}));
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('open spawn and open command failures reject without claiming a started installation',async()=>{
  const directory=temporary();try{
    const file=path.join(directory,'CastLink-Client-1.0.1-aaaaaaaaaaaa-mac-arm64.dmg');fs.writeFileSync(file,'verified fixture');
    for(const failure of ['throw','error','exit']){
      let child;
      const result=macos.launchInstaller(file,{platform:'darwin',arch:'arm64',spawn:()=>{if(failure==='throw')throw Error('OS refused');child=childProcess();return child;}});
      if(failure==='error')child.emit('error',Error('OS refused'));
      if(failure==='exit'){child.emit('spawn');child.emit('close',1);}
      await assert.rejects(result,/could not|unavailable/i);
    }
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
