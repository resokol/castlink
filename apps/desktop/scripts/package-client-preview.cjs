'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {stagePackage}=require('./package-files.cjs'),{buildProcessAudio}=require('./build-process-audio.cjs'),{buildWindowSlides}=require('./build-window-slides.cjs');
function previewConfiguration(desktop,stage,out,resources){return{
 extends:path.join(desktop,'electron-builder.yml'),appId:'ru.castlink.client.preview',productName:'CastLink Client Preview',executableName:'CastLink Client Preview',
 directories:{app:stage,output:out},protocols:[{name:'CastLink presentation component',schemes:['castlink-presenter']}],publish:null,
 extraResources:resources,artifactName:'CastLink-Client-Preview-${version}-win-x64.zip',
 nsis:{include:path.join(desktop,'build/client-preview.nsh'),artifactName:'CastLink-Client-Preview-Setup.exe',shortcutName:'CastLink Client Preview',oneClick:false,perMachine:false,allowElevation:false,allowToChangeInstallationDirectory:true,deleteAppDataOnUninstall:false},
 };}
function stagePreview(root,stage,commit){
 const info={...stagePackage(root,stage,commit),presenterBuild:true,testBuild:false,serverSetup:false,updateChecks:false,manualUpdate:false,autoUpdate:false,windowSlideNavigation:'edge-chrome-pdf',powerPointBridge:4,slidesBridge:4};
 fs.writeFileSync(path.join(stage,'build-info.json'),JSON.stringify(info,null,2)+'\n');
 return info;
}
async function main(){
 if(process.platform!=='win32')throw Error('Windows build required');
 const root=path.resolve(__dirname,'../../..'),desktop=path.join(root,'apps/desktop');
 const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 if(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim())throw Error('Commit the reviewed candidate before packaging');
 const stage=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-client-preview-')),out=path.join(root,'artifacts/client-preview',commit.slice(0,12));
 try{
  const info=stagePreview(root,stage,commit),resources=path.join(stage,'native-resources');
  const audio=buildProcessAudio(root,path.join(resources,'process-audio/CastLink.ProcessAudio.exe'));
  const windowSlides=buildWindowSlides(root,path.join(resources,'window-slides/CastLink.WindowSlides.exe'));
  const config=previewConfiguration(desktop,stage,out,[{from:audio,to:'process-audio/CastLink.ProcessAudio.exe'},{from:windowSlides,to:'window-slides/CastLink.WindowSlides.exe'},{from:path.join(root,'native/windows-powerpoint/Control.ps1'),to:'powerpoint/Control.ps1'}]);
  const {build,Platform,Arch}=require('electron-builder');
  const files=await build({projectDir:desktop,config:{...config,electronVersion:info.electron},targets:Platform.WINDOWS.createTarget(['nsis','zip'],Arch.x64)});
  const entries=files.filter(f=>/\.(exe|zip)$/.test(f)).map(file=>({name:path.basename(file),bytes:fs.statSync(file).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({sourceCommit:commit,info,artifacts:entries},null,2)+'\n');
  fs.writeFileSync(path.join(out,'SHA256SUMS'),entries.map(v=>v.sha256+'  '+v.name).join('\n')+'\n');
  console.log(JSON.stringify({directory:out,sourceCommit:commit,artifacts:entries}));
 }finally{fs.rmSync(stage,{recursive:true,force:true});}
}
module.exports={previewConfiguration,stagePreview};
if(require.main===module)main().catch(()=>{console.error('CastLink client preview packaging failed');process.exitCode=1;});
