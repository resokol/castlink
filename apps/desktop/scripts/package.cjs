'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {stageSetupResources}=require('./setup-resources.cjs');
const {stageUpdaterResources}=require('./updater-resources.cjs');
const {buildProcessAudio}=require('./build-process-audio.cjs');
const {buildWindowSlides}=require('./build-window-slides.cjs');
const {buildRemotePcInput}=require('./build-remote-pc-input.cjs');
const {stagePackage,artifactNames}=require('./package-files.cjs');
async function main(){
  if(process.platform!=='win32')throw Error('Build the Windows client on Windows');
  const root=path.resolve(__dirname,'../../..'),desktop=path.resolve(__dirname,'..');
  const vmixPilotBuild=process.argv?.includes('--vmix-pilot')===true;
  const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  if(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim())throw Error('Commit the candidate before packaging so source provenance is exact');
  const stage=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-client-package-'));
  try{
    const info=stagePackage(root,stage,commit,{vmixOutputs:true,vmixPilotBuild}),short=commit.slice(0,12),out=path.join(root,vmixPilotBuild?'artifacts/vmix-pilot':'artifacts/desktop',short);
    const names=artifactNames(info.version,commit);
    const resources=path.join(stage,'resources');
    const nativeAudio=buildProcessAudio(root,path.join(resources,'process-audio','CastLink.ProcessAudio.exe'));
    const windowSlides=buildWindowSlides(root,path.join(resources,'window-slides','CastLink.WindowSlides.exe'));
    const remoteInput=buildRemotePcInput(root,path.join(resources,'remote-input','CastLink.RemoteInput.exe'));
    const extraResources=[{from:remoteInput,to:'remote-input/CastLink.RemoteInput.exe'},{from:nativeAudio,to:'process-audio/CastLink.ProcessAudio.exe'},{from:windowSlides,to:'window-slides/CastLink.WindowSlides.exe'},{from:path.join(root,'native/windows-powerpoint/Control.ps1'),to:'powerpoint/Control.ps1'}];
    if(!vmixPilotBuild){
      const setup=stageSetupResources(root,resources,commit);
      const updater=stageUpdaterResources(root,resources);
      extraResources.push({from:setup.directory,to:'setup'},{from:updater.file,to:'updater/castlink-updater.ps1'});
    }
    if(info.vmixOutputs){
      const packageManager=process.env.npm_execpath;
      if(!packageManager)throw Error('Run package:win through pnpm');
      const deployment=path.join(stage,'vmix-runtime');
      const deploy=['--config.inject-workspace-packages=true','--config.node-linker=hoisted','--filter','@castlink/desktop','deploy','--prod','--ignore-scripts',deployment];
      if(path.extname(packageManager).toLowerCase()==='.exe')execFileSync(packageManager,deploy,{cwd:root,stdio:'inherit'});
      else execFileSync(process.execPath,[packageManager,...deploy],{cwd:root,stdio:'inherit'});
      const modules=path.join(deployment,'node_modules');
      for(const name of ['@livekit/rtc-ffi-bindings-win32-x64-msvc','@koromix/koffi-win32-x64']){
        if(!fs.existsSync(path.join(modules,name,'package.json')))throw Error(`Missing CastLink Desktop runtime ${name}`);
      }
      extraResources.push({from:modules,to:'vmix/node_modules',filter:['**/*','!.*','!**/.bin/**','!**/.pnpm/**']});
    }
    const {build,Platform,Arch}=require('electron-builder');
    const portableName=vmixPilotBuild?'CastLink-vMix-Pilot-'+info.version+'-'+short+'-Windows-x64.exe':names.unified;
    const pilotOptions=vmixPilotBuild?{appId:'ru.castlink.client.vmix-pilot',productName:'CastLink vMix Pilot',protocols:[],publish:null}:{};
    const files=await build({projectDir:desktop,config:{extends:path.join(desktop,'electron-builder.yml'),afterPack:path.join(__dirname,'windows-wer.cjs'),directories:{app:stage,output:out},electronVersion:info.electron,extraResources,portable:{artifactName:portableName,requestExecutionLevel:'user'},artifactName:names.portable,nsis:{artifactName:names.installer},...pilotOptions},targets:Platform.WINDOWS.createTarget(vmixPilotBuild?['portable']:['zip','nsis','portable'],Arch.x64)});
    const hashes=[];
    for(const file of files){if(!/\.(zip|exe)$/.test(file))continue;const bytes=fs.readFileSync(file);hashes.push(`${crypto.createHash('sha256').update(bytes).digest('hex')}  ${path.basename(file)}`);}
    const manifest=JSON.stringify(info,null,2)+'\n';
    fs.writeFileSync(path.join(out,'manifest.json'),manifest);
    hashes.push(`${crypto.createHash('sha256').update(manifest).digest('hex')}  manifest.json`);
    fs.writeFileSync(path.join(out,'SHA256SUMS'),hashes.join('\n')+'\n');
    if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`artifactDirectory=${out}\n`);
    console.log(JSON.stringify({output:out,artifacts:hashes,sourceCommit:commit}));
  }finally{fs.rmSync(stage,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});

