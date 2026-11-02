'use strict';
// Native CI evidence. Compilation/protocol proofs are distinct from OS effects.
const fs=require('node:fs'),path=require('node:path');
const {spawn,execFileSync}=require('node:child_process');
const {buildMacNative}=require('../apps/desktop/scripts/build-macos-native.cjs');
const MAX_OUTPUT_BYTES=2*1024*1024;
function runCommand(executable,args,{timeoutMs=30000,cwd=path.resolve(__dirname,'..')}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(executable,args,{cwd,shell:false,detached:process.platform==='darwin',stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='',total=0,settled=false,forced;
    const timer=setTimeout(()=>terminate(Error('Native command timed out')),timeoutMs);timer.unref?.();
    function signalOwned(signal){try{if(process.platform==='darwin'&&child.pid)process.kill(-child.pid,signal);else child.kill(signal);}catch{}}
    function terminate(error){if(!forced)forced=error;signalOwned('SIGKILL');}
    function done(error,result){if(settled)return;settled=true;clearTimeout(timer);if(error)reject(error);else resolve(result);}
    function output(kind,chunk){
      total+=chunk.length;if(total>MAX_OUTPUT_BYTES){terminate(Error('Native command output exceeded bound'));return;}
      if(kind==='stdout')stdout+=chunk.toString('utf8');else stderr+=chunk.toString('utf8');
    }
    child.stdout.on('data',chunk=>output('stdout',chunk));child.stderr.on('data',chunk=>output('stderr',chunk));
    child.once('error',()=>done(Error('Native command could not start')));
    child.once('close',(code,signal)=>done(forced,{code,signal,stdout,stderr}));
  });
}
function readJsonFile(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function nativeStatus(value){
  if(!value||!['VERIFIED','NOT VERIFIED','FAILED'].includes(value.status))throw Error('Invalid native evidence status');
  return value;
}
async function runNativeSmoke({arch=process.arch,evidenceDir,resourcesPath,root=path.resolve(__dirname,'..')}){
  if(!evidenceDir)throw Error('Explicit evidence directory required');
  evidenceDir=path.resolve(evidenceDir);resourcesPath=path.resolve(resourcesPath||path.join(evidenceDir,'resources'));
  fs.mkdirSync(evidenceDir,{recursive:true});
  const summary={schemaVersion:1,sourceSha:null,platform:process.platform,arch:process.arch,expectedArch:arch,status:'NOT VERIFIED',checks:[]};
  try{summary.sourceSha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',timeout:5000}).trim();}catch{}
  const write=()=>fs.writeFileSync(path.join(evidenceDir,'native-smoke.json'),JSON.stringify(summary,null,2)+'\n');
  async function check(name,scope,operation){
    try{
      const value=await operation();const result={name,scope,...(value||{status:'VERIFIED'})};
      nativeStatus(result);summary.checks.push(result);write();return result;
    }catch(error){const result={name,scope,status:'FAILED',reason:error.message};summary.checks.push(result);write();return result;}
  }
  async function command(name,executable,args,timeoutMs){
    const result=await runCommand(executable,args,{cwd:root,timeoutMs});
    fs.writeFileSync(path.join(evidenceDir,name+'.stdout.log'),result.stdout);
    fs.writeFileSync(path.join(evidenceDir,name+'.stderr.log'),result.stderr);
    return result;
  }
  async function success(name,executable,args,timeoutMs){
    const result=await command(name,executable,args,timeoutMs);
    if(result.code!==0)throw Error(name+' failed (exit '+result.code+'); see '+name+'.stderr.log');
    return result;
  }
  let helpers;
  await check('native-build','compile-native-helpers',async()=>{
    helpers=buildMacNative({root,resourcesPath,arch});
    return {status:'VERIFIED',helpers:Object.keys(helpers),osOperationVerified:false};
  });
  if(process.platform==='darwin'&&['arm64','x64'].includes(arch)&&arch===process.arch){
    const target=(arch==='x64'?'x86_64':arch)+'-apple-macos15.0';
    const core=path.join(evidenceDir,'InputCoreFixture'),fixture=path.join(evidenceDir,'InputNativeFixture');
    const compile=(name,sources,out)=>success(name,'/usr/bin/xcrun',['swiftc','-swift-version','5','-parse-as-library','-O','-target',target,...sources.map(file=>path.join(root,'native',file)),'-o',out],180000);
    await check('input-core','pure-state-machine',async()=>{
      await compile('input-core-compile',['macos-remote-input/Core.swift','macos-remote-input/CoreFixture.swift'],core);
      await success('input-core-run',core,[],15000);return {status:'VERIFIED',osOperationVerified:false};
    });
    await check('input-native','real-fixture-events-and-window-capture',async()=>{
      if(!helpers?.input)throw Error('Input helper build unavailable');
      await compile('input-fixture-compile',['macos-remote-input/Core.swift','macos-remote-input/NativeFixture.swift'],fixture);
      const artifact=path.join(evidenceDir,'native-input.json');
      const result=await command('input-native-run',process.execPath,[path.join(root,'native/macos-remote-input/native-fixture.cjs'),helpers.input,fixture,artifact],90000);
      const evidence=nativeStatus(readJsonFile(artifact));
      if(result.code!==0||evidence.status==='FAILED')throw Error('Native input fixture failed; see native-input.json and input-native-run logs');
      return {...evidence,artifact:'native-input.json'};
    });
    for(const [name,key]of [['powerpoint-identity','powerpoint'],['window-slides','slides']]){
      await check(name,'native-protocol-self-test',async()=>{
        if(!helpers?.[key])throw Error('Presentation helper build unavailable');
        const result=await success(name,helpers[key],['--self-test'],5000),value=JSON.parse(result.stdout);
        if(value.protocol!==1||value.selfTest!=='passed'||value.osOperationVerified!==false)throw Error('Unexpected presentation self-test protocol');
        return {status:'VERIFIED',protocol:value.protocol,osOperationVerified:false};
      });
    }
    await check('powerpoint-jxa','syntax-compilation-only',async()=>{
      await success('powerpoint-jxa-compile','/usr/bin/osacompile',['-l','JavaScript','-o',path.join(evidenceDir,'PowerPoint.scpt'),path.join(root,'native/macos-presentation/PowerPoint.js')],30000);
      return {status:'VERIFIED',officeLaunched:false,osOperationVerified:false};
    });
    await check('audio-native','real-application-audio-spectral-isolation',async()=>{
      if(!helpers?.audio)throw Error('Audio helper build unavailable');
      // A child process bounds the API and its owned tone/helper process group.
      const entry="const {run,NotVerified}=require(process.argv[1]);run({helper:process.argv[2]}).then(value=>console.log(JSON.stringify({status:'VERIFIED',...value}))).catch(error=>{const unavailable=error instanceof NotVerified;console.log(JSON.stringify({status:unavailable?'NOT VERIFIED':'FAILED',reason:error.message}));process.exitCode=unavailable?3:1;});";
      const result=await command('audio-native-run',process.execPath,['-e',entry,path.join(root,'native/macos-process-audio/smoke.cjs'),helpers.audio],90000);
      const evidence=nativeStatus(JSON.parse(result.stdout.trim()));
      fs.writeFileSync(path.join(evidenceDir,'native-audio.json'),JSON.stringify(evidence,null,2)+'\n');
      if(evidence.status==='FAILED'||result.code!==0&&!(result.code===3&&evidence.status==='NOT VERIFIED'))throw Error('Native audio fixture failed; see native-audio.json and audio-native-run logs');
      return {...evidence,artifact:'native-audio.json'};
    });
  }
  summary.checks.push({name:'interactive-acceptance',scope:'installed-office-physical-input-microphone-spaces-and-displays',status:'NOT VERIFIED',reason:'Requires interactive acceptance on this native architecture; compilation and synthetic app fixtures do not establish these checks.'});
  summary.status=summary.checks.some(check=>check.status==='FAILED')?'FAILED':summary.checks.some(check=>check.status==='NOT VERIFIED')?'NOT VERIFIED':'VERIFIED';
  write();return summary;
}
module.exports={runNativeSmoke,runCommand,nativeStatus};
if(require.main===module){
  const [evidenceDir,resourcesPath]=process.argv.slice(2);
  runNativeSmoke({arch,evidenceDir,resourcesPath}).then(summary=>{console.log(JSON.stringify(summary,null,2));if(summary.status==='FAILED')process.exitCode=1;}).catch(error=>{console.error(error.message);process.exitCode=1;});
}
