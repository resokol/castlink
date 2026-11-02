'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn,execFileSync}=require('node:child_process');
const {EventEmitter}=require('node:events');
const {PassThrough}=require('node:stream');
const {createMacProcessAudioAdapter,probeMacProcessAudio}=require('../../apps/desktop/src/macos-process-audio.cjs');
const {analyzePcm}=require('../../apps/desktop/tests/windows-process-audio-smoke.cjs');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class NotVerified extends Error {}
function toneReady(child,{frequency=null,timeoutMs=10000}={}){
  return new Promise((resolve,reject)=>{
    let output='',stderr=Buffer.alloc(0),stderrTruncated=false,settled=false,exitCode=null,exitSignal=null;
    const timer=setTimeout(()=>finish(Error('QA fixture readiness timed out'),undefined,true),timeoutMs);
    function finish(error,value,timedOut=false){
      if(settled)return;settled=true;clearTimeout(timer);
      if(error){
        error.diagnostics={fixture:'owned-audio-tone',frequency,exitCode,signal:exitSignal,timedOut,stderr:stderr.toString('utf8').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'?'),stderrTruncated};
        reject(error);
      }else resolve(value);
    }
    child.stdout.on('data',chunk=>{
      if(settled)return;output+=chunk.toString('utf8');if(output.length>4096){finish(Error('Invalid QA readiness'));return;}
      if(!output.includes('\n'))return;
      try{const value=JSON.parse(output.slice(0,output.indexOf('\n')));if(value.ready!==true||!/^\d+$/.test(value.windowId)||!Number.isInteger(value.pid)||!Number.isSafeInteger(value.processStartTime)||frequency!==null&&value.frequency!==frequency)throw Error();finish(null,value);}catch{finish(Error('Invalid QA readiness'));}
    });
    child.stderr.on('data',chunk=>{
      if(stderr.length+chunk.length>8192)stderrTruncated=true;
      if(stderr.length<8192)stderr=Buffer.concat([stderr,chunk.subarray(0,8192-stderr.length)]);
    });
    child.once('error',error=>{const failure=Error('QA fixture launch failed');if(typeof error.code==='string')failure.code=error.code.slice(0,40);finish(failure);});
    child.once('exit',(code,signal)=>{exitCode=code;exitSignal=signal||null;});
    // close follows stderr drain, so crash/identity diagnostics are not lost.
    child.once('close',(code,signal)=>{
      exitCode=code;exitSignal=signal||null;
      const unavailable=code===3&&/^qa-no-output$/m.test(stderr.toString('utf8'));
      finish(unavailable?new NotVerified('No real audio output device'):Error('QA fixture exited before readiness'));
    });
  });
}
function toneFileReady(wrapper,{stdoutPath,stderrPath,frequency,timeoutMs=10000}){
  // LaunchServices owns the real GUI app, so open(1) redirects its real output
  // into private fixture files. This transport only forwards bounded bytes.
  const transport=new EventEmitter();transport.stdout=new PassThrough();transport.stderr=new PassThrough();transport.on('error',()=>{});
  const ready=toneReady(transport,{frequency,timeoutMs});let done=false,stdoutOffset=0,stderrOffset=0;
  function read(file,offset,maximum,stream){
    try{
      const stat=fs.lstatSync(file);if(!stat.isFile())throw Error('Invalid owned QA output file');
      const size=Math.min(Math.max(stat.size-offset,0),maximum-offset);if(size<=0)return offset;
      const fd=fs.openSync(file,'r'),buffer=Buffer.alloc(size);let count;
      try{count=fs.readSync(fd,buffer,0,size,offset);}finally{fs.closeSync(fd);}
      if(count)stream.write(buffer.subarray(0,count));return offset+count;
    }catch(error){if(error.code!=='ENOENT')transport.emit('error',Error('Owned QA output could not be read'));return offset;}
  }
  function pump(){if(done)return;stderrOffset=read(stderrPath,stderrOffset,8193,transport.stderr);stdoutOffset=read(stdoutPath,stdoutOffset,4097,transport.stdout);}
  const interval=setInterval(pump,25);
  wrapper.stdout?.resume();wrapper.stderr?.on('data',chunk=>{if(!done)transport.stderr.write(chunk);});
  wrapper.once('error',error=>{if(!done)transport.emit('error',error);});
  wrapper.once('close',(code,signal)=>{if(!done){pump();transport.emit('close',code,signal);}});
  pump();
  return ready.finally(()=>{done=true;clearInterval(interval);transport.stdout.destroy();transport.stderr.destroy();});
}
function terminateOwnedApplication({executable,appURL,identity}){
  // The fixture utility checks exact bundle URL + executable + kernel birth
  // immediately before terminating its retained NSRunningApplication.
  const args=identity?['--terminate',String(identity.pid),String(identity.processStartTime),appURL]:['--terminate-owned-url',appURL];
  execFileSync(executable,args,{shell:false,stdio:'pipe',timeout:3000,maxBuffer:8192});
}

function assessNativeCapture(pcm,context={}){
  const analysis=analyzePcm(pcm);
  if(analysis.pass)return analysis;
  const frames=pcm.length/8,peak=[0,0],squares=[0,0],dc=[0,0];let nonzeroFrames=0;
  for(let frame=0;frame<frames;frame++){
    let nonzero=false;
    for(let channel=0;channel<2;channel++){
      const value=pcm.readFloatLE(frame*8+channel*4);peak[channel]=Math.max(peak[channel],Math.abs(value));squares[channel]+=value*value;dc[channel]+=value;if(value!==0)nonzero=true;
    }
    if(nonzero)nonzeroFrames++;
  }
  const seconds=[];
  for(let offset=0;offset+48000*8<=pcm.length&&seconds.length<8;offset+=48000*8)seconds.push(analyzePcm(pcm.subarray(offset,offset+48000*8)));
  const error=Error('Real ScreenCaptureKit spectral isolation failed');
  error.diagnostics={stage:'spectral-isolation',analysis,pcm:{totalFrames:frames,nonzeroFrames,peak,rms:squares.map(value=>Math.sqrt(value/frames)),dc:dc.map(value=>value/frames)},seconds,expectedFrequencies:[440,880,1320],...context};
  throw error;
}

async function run({helper,durationMs=3200,launchMode='direct'}){
  if(!['direct','launchservices'].includes(launchMode))throw Error('Invalid owned QA launch mode');
  if(process.platform!=='darwin'||!['arm64','x64'].includes(process.arch))throw Error('Run native audio QA on macOS arm64 or x64');
  if(!helper||!fs.lstatSync(helper).isFile())throw Error('Compiled helper required');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-macos-audio-qa-')),owned=[],ownedApplications=[];
  let capture;
  try{
    const target=process.arch==='arm64'?'arm64':'x86_64',binary=path.join(directory,'ToneFixture');
    execFileSync('xcrun',['swiftc','-swift-version','5','-parse-as-library','-O','-target',target+'-apple-macos13.0',path.join(__dirname,'../macos-common/ProcessBirth.swift'),path.join(__dirname,'ToneFixture.swift'),'-framework','AppKit','-framework','AVFoundation','-o',binary],{stdio:'pipe'});
    const players=[];
    for(const [index,frequency,bundle]of [[0,440,'com.microsoft.Powerpoint'],[1,880,'org.castlink.qa.private-return'],[2,1320,'org.castlink.qa.other-rendered']]){
      const contents=path.join(directory,'AudioQA'+index+'.app','Contents'),executable=path.join(contents,'MacOS','ToneFixture');
      fs.mkdirSync(path.dirname(executable),{recursive:true});fs.copyFileSync(binary,executable);fs.chmodSync(executable,0o755);
      fs.writeFileSync(path.join(contents,'Info.plist'),'<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>'+bundle+'</string><key>CFBundleExecutable</key><string>ToneFixture</string><key>CFBundleName</key><string>CastLink owned audio QA</string><key>CFBundlePackageType</key><string>APPL</string><key>LSMinimumSystemVersion</key><string>13.0</string></dict></plist>');
      execFileSync('codesign',['--force','--sign','-',path.dirname(contents)],{stdio:'pipe'});
      if(launchMode==='launchservices'){
        const appURL=path.dirname(contents),stdoutPath=path.join(directory,'AudioQA'+index+'.stdout'),stderrPath=path.join(directory,'AudioQA'+index+'.stderr');
        fs.writeFileSync(stdoutPath,'',{mode:0o600});fs.writeFileSync(stderrPath,'',{mode:0o600});
        const application={executable,appURL,identity:null};ownedApplications.push(application);
        const child=spawn('/usr/bin/open',['-n','-W','--stdout',stdoutPath,'--stderr',stderrPath,appURL,'--args',String(frequency)],{shell:false,stdio:['ignore','pipe','pipe']});owned.push(child);
        const identity=await toneFileReady(child,{stdoutPath,stderrPath,frequency});players.push(identity);application.identity=identity;
      }else{
        const child=spawn(executable,[String(frequency)],{shell:false,stdio:['ignore','pipe','pipe']});owned.push(child);players.push(await toneReady(child,{frequency}));
      }
    }
    const resourcesPath=path.join(directory,'resources'),resourceHelper=path.join(resourcesPath,'process-audio','CastLink.ProcessAudio');
    fs.mkdirSync(path.dirname(resourceHelper),{recursive:true});fs.copyFileSync(helper,resourceHelper);fs.chmodSync(resourceHelper,0o755);
    const diagnostics=[];
    const nativeSpawn=(...args)=>{const child=spawn(...args);owned.push(child);child.stderr.on('data',chunk=>{if(diagnostics.length<8)diagnostics.push(chunk.toString('utf8').slice(0,160));});return child;};
    if(!await probeMacProcessAudio({resourcesPath,spawn:nativeSpawn}))throw Error('Native protocol probe failed');
    const adapter=createMacProcessAudioAdapter({resourcesPath,spawn:nativeSpawn});
    // A valid foreign app window must refuse, proving there is no system fallback.
    const foreign=adapter.start({sourceId:'window:'+players[1].windowId+':0',sourceIdentity:players[1],enabled:true});
    try{await foreign.ready;foreign.stop();throw Error('Foreign application was accepted');}catch(error){if(error.message==='Foreign application was accepted')throw error;}
    const chunks=[];let bytes=0,streamError,packets=0,minPacketFrames=4800,maxPacketFrames=0;
    capture=adapter.start({sourceId:'window:'+players[0].windowId+':0',sourceIdentity:players[0],enabled:true,onFrame:packet=>{
      packets++;minPacketFrames=Math.min(minPacketFrames,packet.frames);maxPacketFrames=Math.max(maxPacketFrames,packet.frames);bytes+=packet.pcm.length;if(bytes>48000*8*8)throw Error('QA capture bound exceeded');chunks.push(packet.pcm);
    },onError:error=>{streamError=error;}});
    let metadata;
    try{metadata=await capture.ready;}catch{
      if(diagnostics.some(text=>text.includes('source-or-permission')))throw new NotVerified('Screen Recording permission or live GUI source unavailable');
      throw Error('Native audio capture refused');
    }
    await delay(durationMs);capture.stop();
    if(streamError)throw Error('Native audio capture stopped');
    if(metadata.pid!==players[0].pid)throw Error('Wrong native source identity');
    if(owned.slice(0,3).some(child=>child.exitCode!==null))throw Error('QA tone stopped during capture');
    const captureEvidence={sampleRate:metadata.sampleRate,channels:metadata.channels,pid:metadata.pid,packets,minPacketFrames,maxPacketFrames};
    const playerEvidence=players.map(({frequency,pid,outputSampleRate,outputChannels,playerDuration,playerPlaying,audioIdentity,launchServicesLaunchDateAvailable})=>({frequency,pid,outputSampleRate,outputChannels,playerDuration,playerPlaying,audioIdentity,launchServicesLaunchDateAvailable}));
    const analysis=assessNativeCapture(Buffer.concat(chunks),{launchMode,capture:captureEvidence,players:playerEvidence});
    // Source lifetime is an independent check, not merely the successful FFT.
    let ended=false;
    capture=adapter.start({sourceId:'window:'+players[0].windowId+':0',sourceIdentity:players[0],enabled:true,onEnded:()=>{ended=true;}});
    await capture.ready;if(launchMode==='launchservices')terminateOwnedApplication(ownedApplications[0]);else owned[0].kill('SIGTERM');await delay(300);
    if(!ended)throw Error('Closed source did not terminate native capture');
    return {...analysis,native:true,launchMode,capture:captureEvidence,players:playerEvidence,arch:process.arch,macOS:os.release(),source:'owned QA app using PowerPoint bundle ID; installed Office NOT VERIFIED',foreignApplicationRefused:true,sourceTermination:true,physicalMicrophoneTested:false};
  }finally{
    capture?.stop();
    for(const application of ownedApplications)try{terminateOwnedApplication(application);}catch{/* Refuse any changed identity; never kill an unverified PID. */}
    await Promise.all(owned.map(child=>new Promise(resolve=>{
      if(child.exitCode!==null||child.signalCode!==null){resolve();return;}
      const timeout=setTimeout(()=>{child.kill('SIGKILL');resolve();},1500);
      child.once('exit',()=>{clearTimeout(timeout);resolve();});child.kill('SIGTERM');
    })));
    fs.rmSync(directory,{recursive:true,force:true});
  }
}
module.exports={run,NotVerified,toneReady,toneFileReady,assessNativeCapture};
if(require.main===module){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--helper'){console.error('Usage: node native/macos-process-audio/smoke.cjs --helper <compiled-helper>');process.exitCode=1;}
  else run({helper:path.resolve(args[1])}).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error((error instanceof NotVerified?'NOT VERIFIED: ':'FAIL: ')+error.message);process.exitCode=error instanceof NotVerified?3:1;});
}
