'use strict';
const fs=require('node:fs'),path=require('node:path');
const {spawn:spawnProcess}=require('node:child_process');
const MAX_PACKET_FRAMES=4800,MAX_BUFFER_BYTES=131072;
function macWindowId(sourceId){
  const match=typeof sourceId==='string'&&/^window:([1-9][0-9]*):(0|[1-9][0-9]*)$/.exec(sourceId);
  return match&&Number.isSafeInteger(Number(match[1]))&&Number(match[1])<=0xffffffff?match[1]:null;
}
function executableAt(resourcesPath){
  try{
    if(typeof resourcesPath!=='string')return null;
    const executable=path.join(resourcesPath,'process-audio','CastLink.ProcessAudio');
    if(!fs.lstatSync(executable).isFile())return null;
    fs.accessSync(executable,fs.constants.X_OK);return executable;
  }catch{return null;}
}
function notify(callback,value){try{callback(value);}catch{/* Cleanup must survive consumer callbacks. */}}
function createMacProcessAudioAdapter({resourcesPath,platform=process.platform,spawn=spawnProcess,startupTimeoutMs=12000,terminationTimeoutMs=1000}){
  return {start({sourceId,sourceIdentity,enabled,onFrame=()=>{},onError=()=>{},onEnded=()=>{}}){
    if(enabled!==true)throw Error('PowerPoint audio requires explicit selection');
    const windowId=macWindowId(sourceId);if(!windowId)throw Error('Invalid PowerPoint audio source');
    if(platform!=='darwin')throw Error('PowerPoint process audio requires macOS');
    const args=['--window',windowId];let expectedPid=null;
    if(sourceIdentity!==undefined){
      if(!sourceIdentity||sourceIdentity.windowId!==windowId||!Number.isInteger(sourceIdentity.pid)||sourceIdentity.pid<1||sourceIdentity.pid>0x7fffffff||!Number.isSafeInteger(sourceIdentity.processStartTime)||sourceIdentity.processStartTime<1)throw Error('Invalid PowerPoint audio source identity');
      expectedPid=sourceIdentity.pid;args.push('--pid',String(expectedPid),'--started',String(sourceIdentity.processStartTime));
    }
    const executable=executableAt(resourcesPath);if(!executable)throw Error('PowerPoint audio helper is unavailable');
    let child;
    try{child=spawn(executable,args,{shell:false,stdio:['pipe','pipe','pipe'],windowsHide:true});}catch{throw Error('PowerPoint process audio could not start');}
    let stopped=false,exited=false,metadata=null,pending=Buffer.alloc(0),resolveReady,rejectReady,termination,terminationSent=false,stderrEnded=false,childClosed=false,stderrTail='',launchRequired=false,startupFailure=null,refusalTimer;
    const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
    const timeout=setTimeout(()=>finish(Error('PowerPoint process audio could not start')),startupTimeoutMs);timeout.unref?.();
    function sourceError(fallback){
      if(!launchRequired)return fallback;
      const error=Error('PowerPoint must be opened from Applications');error.code='PROCESS_AUDIO_LAUNCH_REQUIRED';return error;
    }
    function terminate(){
      if(exited||terminationSent)return;terminationSent=true;
      try{child.kill('SIGTERM');}catch{/* Exit may race Stop. */}
      termination=setTimeout(()=>{if(!exited)try{child.kill('SIGKILL');}catch{/* Already reaped. */}},terminationTimeoutMs);termination.unref?.();
    }
    function rejectStartup(error){
      if(stopped)return;startupFailure=error;pending=Buffer.alloc(0);terminate();
      if(launchRequired||stderrEnded||childClosed){finish(sourceError(error));return;}
      // Stdout EOF and exit can precede stderr drain. Only startup refusal waits,
      // bounded to100ms, while the helper is already being terminated.
      if(!refusalTimer){refusalTimer=setTimeout(()=>finish(sourceError(startupFailure)),100);refusalTimer.unref?.();}
    }
    function finish(error){
      if(stopped)return;stopped=true;clearTimeout(timeout);clearTimeout(refusalTimer);pending=Buffer.alloc(0);
      if(!metadata)rejectReady(error||Error('PowerPoint process audio stopped'));
      child.stdin?.destroy();child.stdout?.destroy();child.stderr?.destroy();
      terminate();
      if(error)notify(onError,error);notify(onEnded);
    }
    child.once('error',()=>finish(Error('PowerPoint process audio could not start')));
    child.once('exit',code=>{exited=true;clearTimeout(termination);if(!metadata)rejectStartup(Error('PowerPoint process audio stopped'));else finish(code===0&&pending.length===0?null:Error('PowerPoint process audio stopped'));});
    child.once('close',()=>{childClosed=true;if(startupFailure)finish(sourceError(startupFailure));});
    // Only this fixed public refusal code crosses the native boundary. All
    // arbitrary diagnostics, paths, titles and OS error text are discarded.
    child.stderr?.on('data',chunk=>{
      if(stopped||metadata)return;
      const lines=(stderrTail+chunk.toString('ascii')).split('\n');stderrTail=lines.pop().slice(-128);
      if(lines.some(line=>line==='process-audio-refused:source-launch-services'))launchRequired=true;
      if(startupFailure&&launchRequired)finish(sourceError(startupFailure));
    });
    child.stderr?.once('end',()=>{stderrEnded=true;if(startupFailure)finish(sourceError(startupFailure));});
    child.stdin?.on('error',()=>finish(Error('PowerPoint process audio stopped')));
    child.stdout.on('error',()=>finish(Error('PowerPoint process audio stopped')));
    child.stdout.once('end',()=>{if(!metadata)rejectStartup(Error('Invalid process audio data'));else finish(pending.length===0?null:Error('Invalid process audio data'));});
    child.stdout.on('data',chunk=>{
      if(stopped||startupFailure)return;
      if(!Buffer.isBuffer(chunk)||chunk.length+pending.length>MAX_BUFFER_BYTES){finish(Error('Invalid process audio data'));return;}
      pending=Buffer.concat([pending,chunk]);
      if(!metadata){
        if(pending.length<24)return;
        if(pending.toString('ascii',0,8)!=='CLPA0001'||pending.readUInt32LE(8)!==48000||pending.readUInt16LE(12)!==2||pending.readUInt16LE(14)!==32||pending.readUInt32LE(16)===0||pending.readUInt32LE(20)!==0){finish(Error('Invalid process audio format'));return;}
        const pid=pending.readUInt32LE(16);if(expectedPid!==null&&pid!==expectedPid){finish(Error('PowerPoint audio source changed'));return;}
        metadata={sampleRate:48000,channels:2,pid};pending=pending.subarray(24);clearTimeout(timeout);resolveReady(metadata);
      }
      while(!stopped&&pending.length>=4){
        const frames=pending.readUInt32LE(0);
        if(frames<1||frames>MAX_PACKET_FRAMES){finish(Error('Invalid process audio packet'));return;}
        const length=4+frames*8;if(pending.length<length)return;
        const pcm=Buffer.from(pending.subarray(4,length));pending=pending.subarray(length);
        for(let i=0;i<pcm.length;i+=4)if(!Number.isFinite(pcm.readFloatLE(i))){finish(Error('Invalid process audio PCM'));return;}
        try{onFrame({sampleRate:48000,channels:2,frames,pcm});}catch{finish(Error('PowerPoint process audio delivery failed'));}
      }
    });
    return {ready,stop:()=>finish(null)};
  }};
}
function probeMacProcessAudio({resourcesPath,platform=process.platform,spawn=spawnProcess,timeoutMs=3000}){
  const executable=platform==='darwin'&&executableAt(resourcesPath);if(!executable)return Promise.resolve(false);
  return new Promise(resolve=>{
    let child;try{child=spawn(executable,['--self-test'],{shell:false,stdio:['ignore','pipe','pipe'],windowsHide:true});}catch{resolve(false);return;}
    let ended=false,output=Buffer.alloc(0),exitCode,stdoutEnded=false;
    const timer=setTimeout(()=>finish(false),timeoutMs);timer.unref?.();
    function finish(result){if(ended)return;ended=true;clearTimeout(timer);child.stdout?.destroy();child.stderr?.destroy();if(exitCode===undefined)try{child.kill('SIGKILL');}catch{}resolve(result);}
    function check(){
      if(exitCode===undefined||!stdoutEnded)return;
      try{const value=JSON.parse(output.toString('utf8'));finish(exitCode===0&&value.protocol==='CLPA0001'&&value.sampleRate===48000&&value.channels===2&&value.maxPacketFrames===MAX_PACKET_FRAMES);}catch{finish(false);}
    }
    child.stdout.on('data',chunk=>{if(ended)return;if(output.length+chunk.length>4096){finish(false);return;}output=Buffer.concat([output,chunk]);});
    child.stdout.once('end',()=>{stdoutEnded=true;check();});child.stdout.once('error',()=>finish(false));child.stderr?.on('data',()=>{});
    child.once('error',()=>finish(false));child.once('exit',code=>{exitCode=code;check();});
  });
}
module.exports={createMacProcessAudioAdapter,probeMacProcessAudio,macWindowId};
