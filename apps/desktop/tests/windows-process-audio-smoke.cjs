'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn,execFileSync}=require('node:child_process');
const {createProcessAudioAdapter}=require('../src/process-audio.cjs');

// Direct Fourier amplitudes at the three known frequencies. Whole-second
// intervals avoid bin leakage; both stereo channels are checked independently.
function analyzePcm(pcm){
  if(!Buffer.isBuffer(pcm)||pcm.length%8||pcm.length<48000*8)throw Error('Insufficient or invalid PCM');
  const frames=Math.floor(pcm.length/(48000*8))*48000,frequencies=[440,880,1320],amplitudes={};
  for(let i=0;i<frames*2;i++)if(!Number.isFinite(pcm.readFloatLE(i*4)))throw Error('Invalid float PCM');
  for(const frequency of frequencies){
    let maximum=0;
    for(let channel=0;channel<2;channel++){
      let real=0,imaginary=0;
      for(let frame=0;frame<frames;frame++){
        const angle=2*Math.PI*frequency*frame/48000,value=pcm.readFloatLE(frame*8+channel*4);
        real+=value*Math.cos(angle);imaginary+=value*Math.sin(angle);
      }
      maximum=Math.max(maximum,2*Math.hypot(real,imaginary)/frames);
    }
    amplitudes[String(frequency)]=maximum;
  }
  const selected=amplitudes['440'],ratiosDb={};
  for(const frequency of [880,1320])ratiosDb[String(frequency)]=20*Math.log10(Math.max(amplitudes[String(frequency)],1e-12)/Math.max(selected,1e-12));
  return {pass:selected>.005&&ratiosDb['880'] < -50&&ratiosDb['1320'] < -50,frames,seconds:frames/48000,amplitudes,ratiosDb};
}
function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function waitForTone(child){
  return new Promise((resolve,reject)=>{
    let output='',diagnostic='';const timer=setTimeout(()=>finish(Error('QA tone startup timed out')),8000);
    function finish(error,value){clearTimeout(timer);child.stdout.off('data',read);if(error)reject(error);else resolve(value);}
    function read(bytes){
      output+=bytes.toString('utf8');if(output.length>4096){finish(Error('QA tone output overflow'));return;}
      if(output.includes('\n')){
        try{const value=JSON.parse(output.slice(0,output.indexOf('\n')));if(value.ready!==true||!/^\d+$/.test(value.hwnd)||!Number.isInteger(value.pid))throw Error();finish(null,value);}
        catch{finish(Error('Invalid QA tone readiness'));}
      }
    }
    child.stdout.on('data',read);child.stderr.on('data',bytes=>{diagnostic=(diagnostic+bytes.toString('utf8')).slice(0,200);});
    child.once('error',()=>finish(Error('QA tone process could not start')));
    child.once('exit',code=>{if(code!==0)finish(Error('QA tone failed: '+diagnostic.replace(/[^a-z0-9:-]/gi,'')));});
  });
}
async function run({helper,durationMs=3200}){
  if(process.platform!=='win32')throw Error('Windows-only real process audio smoke');
  if(!helper||!fs.lstatSync(helper).isFile())throw Error('Provide the compiled helper with --helper');
  const compiler=path.win32.join(process.env.SystemRoot||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-process-audio-smoke-')),owned=[];
  let capture;const chunks=[];let bytes=0,streamError;
  try{
    const target=path.join(directory,'POWERPNT.exe');
    execFileSync(compiler,['/nologo','/codepage:65001','/target:exe','/platform:x64','/optimize+','/warnaserror+','/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll','/out:'+target,path.join(__dirname,'fixtures','process-audio-tone.cs')],{stdio:'pipe',windowsHide:true});
    const privateReturn=path.join(directory,'PrivateReturn.exe'),otherRendered=path.join(directory,'OtherRendered.exe');fs.copyFileSync(target,privateReturn);fs.copyFileSync(target,otherRendered);
    const players=[];
    for(const [executable,frequency]of [[target,440],[privateReturn,880],[otherRendered,1320]]){
      const child=spawn(executable,[String(frequency)],{stdio:['ignore','pipe','pipe'],shell:false,windowsHide:true});owned.push(child);players.push(await waitForTone(child));
    }
    const resourcesPath=path.join(directory,'resources'),resourceHelper=path.join(resourcesPath,'process-audio','CastLink.ProcessAudio.exe');fs.mkdirSync(path.dirname(resourceHelper),{recursive:true});fs.copyFileSync(helper,resourceHelper);
    const diagnostics=[];
    const adapter=createProcessAudioAdapter({resourcesPath,spawn:(...args)=>{
      const child=spawn(...args);owned.push(child);child.stderr.on('data',data=>{if(diagnostics.length<8)diagnostics.push(data.toString('utf8').replace(/[^a-z0-9:._\-\n]/gi,'').slice(0,200));});return child;
    }});
    capture=adapter.start({sourceId:'window:'+players[0].hwnd+':0',enabled:true,onFrame:packet=>{
      bytes+=packet.pcm.length;if(bytes>48000*8*8)throw Error('QA capture exceeded bound');chunks.push(packet.pcm);
    },onError:error=>{streamError=error;}});
    let metadata;
    try{metadata=await capture.ready;await delay(durationMs);}
    catch{throw Error('Native capture refused: '+diagnostics.join('').trim());}
    capture.stop();
    if(streamError)throw Error('Native capture stopped: '+diagnostics.join('').trim());
    if(metadata.pid!==players[0].pid)throw Error('Wrong native source PID');
    for(const child of owned.slice(0,3))if(child.exitCode!==null)throw Error('A competing QA tone stopped during capture');
    const analysis=analyzePcm(Buffer.concat(chunks));
    const result={...analysis,native:true,build:Number(os.release().split('.')[2]),sampleRate:metadata.sampleRate,channels:metadata.channels,source:'owned QA POWERPNT.exe, not installed Microsoft Office',competingRenderedFrequencies:[880,1320],physicalMicrophoneTested:false};
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
    if(!analysis.pass)throw Error('Process audio spectral isolation failed');
    return result;
  }finally{
    capture?.stop();
    await Promise.all(owned.map(child=>new Promise(resolve=>{
      if(child.exitCode!==null||child.signalCode!==null){resolve();return;}
      const timeout=setTimeout(resolve,2000);child.once('exit',()=>{clearTimeout(timeout);resolve();});child.kill();
    })));
    fs.rmSync(directory,{recursive:true,force:true});
  }
}
module.exports={analyzePcm,run};
if(require.main===module){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--helper'){console.error('Usage: node windows-process-audio-smoke.cjs --helper <compiled-helper.exe>');process.exitCode=1;}
  else run({helper:path.resolve(args[1])}).catch(error=>{console.error(error.message);process.exitCode=1;});
}
