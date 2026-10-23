'use strict';
const fs=require('node:fs'),path=require('node:path');
const {spawn:spawnProcess}=require('node:child_process');
const MAX_PACKET_FRAMES=4800,MAX_BUFFER_BYTES=131072;

function createProcessAudioAdapter({resourcesPath,platform=process.platform,spawn=spawnProcess,startupTimeoutMs=12000}){
  return {
    start({sourceId,enabled,onFrame=()=>{},onError=()=>{},onEnded=()=>{}}){
      if(enabled!==true)throw Error('PowerPoint audio requires explicit selection');
      const hwnd=require('./remote-pc-protocol.cjs').windowHandle(sourceId);
      if(!hwnd)throw Error('Invalid PowerPoint audio source');
      if(platform!=='win32')throw Error('PowerPoint process audio requires Windows');
      const executable=path.join(resourcesPath,'process-audio','CastLink.ProcessAudio.exe');
      if(!fs.existsSync(executable)||!fs.lstatSync(executable).isFile())throw Error('PowerPoint audio helper is unavailable');
      const child=spawn(executable,['--window',hwnd],{shell:false,stdio:['pipe','pipe','pipe'],windowsHide:true});
      let stopped=false,metadata=null,pending=Buffer.alloc(0),resolveReady,rejectReady;
      const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
      const timeout=setTimeout(()=>finish(Error('PowerPoint process audio could not start')),startupTimeoutMs);timeout.unref?.();
      function finish(error){
        if(stopped)return;stopped=true;clearTimeout(timeout);pending=Buffer.alloc(0);
        if(!metadata)rejectReady(error||Error('PowerPoint process audio stopped'));
        child.stdin?.destroy();child.stdout?.destroy();child.stderr?.destroy();
        if(!child.killed)child.kill();
        if(error)onError(error);
        onEnded();
      }
      child.once('error',()=>finish(Error('PowerPoint process audio could not start')));
      child.once('exit',code=>finish(code===0?null:Error('PowerPoint process audio stopped')));
      // Never forward native diagnostics or paths to renderer/server logs.
      child.stderr.on('data',()=>{});
      child.stdout.on('data',chunk=>{
        if(stopped)return;
        if(chunk.length+pending.length>MAX_BUFFER_BYTES){finish(Error('Invalid process audio data'));return;}
        pending=Buffer.concat([pending,chunk]);
        if(!metadata){
          if(pending.length<24)return;
          if(pending.toString('ascii',0,8)!=='CLPA0001'||pending.readUInt32LE(8)!==48000||pending.readUInt16LE(12)!==2||pending.readUInt16LE(14)!==32||pending.readUInt32LE(16)===0||pending.readUInt32LE(20)!==0){finish(Error('Invalid process audio format'));return;}
          metadata={sampleRate:48000,channels:2,pid:pending.readUInt32LE(16)};
          pending=pending.subarray(24);clearTimeout(timeout);resolveReady(metadata);
        }
        while(!stopped&&pending.length>=4){
          const frames=pending.readUInt32LE(0);
          if(frames<1||frames>MAX_PACKET_FRAMES){finish(Error('Invalid process audio packet'));return;}
          const length=4+frames*8;if(pending.length<length)return;
          const pcm=Buffer.from(pending.subarray(4,length));pending=pending.subarray(length);
          try{onFrame({sampleRate:48000,channels:2,frames,pcm});}
          catch{finish(Error('PowerPoint process audio delivery failed'));}
        }
      });
      return {ready,stop:()=>finish(null)};
    },
  };
}
module.exports={createProcessAudioAdapter};
