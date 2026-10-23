'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {stageScreenShare,PACKAGE_FILES}=require('./screen-share-package-files.cjs');
const {buildProcessAudio}=require('./build-process-audio.cjs'),{buildRemotePcInput}=require('./build-remote-pc-input.cjs');
function screenShareConfiguration(desktop,stage,out,resources,info){
 const prefix='CastLink-Screen-Share-'+info.version+'-'+info.sourceCommit.slice(0,12);
 return {
  extends:null,appId:'ru.castlink.screen-share',productName:'CastLink Screen Share',executableName:'CastLink Screen Share',asar:true,
  directories:{app:stage,output:out},protocols:[{name:'CastLink screen sharing',schemes:['castlink-share']}],publish:null,
  files:[...PACKAGE_FILES,'package.json','build-info.json','LICENSE','THIRD_PARTY_NOTICES'],extraResources:resources,
  artifactName:prefix+'-win-x64.${ext}',
  win:{icon:path.join(desktop,'assets/castlink-icon.ico'),signAndEditExecutable:true},
  nsis:{artifactName:prefix+'-setup.exe',oneClick:true,perMachine:false,allowElevation:false,runAfterFinish:false,createDesktopShortcut:false,createStartMenuShortcut:false,deleteAppDataOnUninstall:false,installerLanguages:['en_US','ru_RU','zh_CN']},
 };
}
// Passing an object causes builder26 to auto-load the full-client YAML first.
// An explicit isolated file prevents that merge (extends:null alone does not).
function screenShareBuildOptions(desktop,work,config,targets){
 const file=path.join(work,'screen-share-builder.json');
 fs.writeFileSync(file,JSON.stringify(config,null,2)+'\n');
 return {projectDir:desktop,config:file,...(targets?{targets}:{})};
}
async function main(){
 if(process.platform!=='win32')throw Error('Windows build required');
 const root=path.resolve(__dirname,'../../..'),desktop=path.join(root,'apps/desktop');
 const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 if(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim())throw Error('Commit the reviewed candidate before packaging');
 const work=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-screen-share-')),stage=path.join(work,'app'),out=path.join(root,'artifacts/screen-share',commit.slice(0,12));
 try{
  const info=stageScreenShare(root,stage,commit),native=path.join(work,'native');
  const input=buildRemotePcInput(root,path.join(native,'remote-input/CastLink.RemoteInput.exe'));
  const audio=buildProcessAudio(root,path.join(native,'process-audio/CastLink.ProcessAudio.exe'));
  const config=screenShareConfiguration(desktop,stage,out,[{from:input,to:'remote-input/CastLink.RemoteInput.exe'},{from:audio,to:'process-audio/CastLink.ProcessAudio.exe'}],info);
  const {build,Platform,Arch}=require('electron-builder');
  const files=await build(screenShareBuildOptions(desktop,work,{...config,electronVersion:info.electron},Platform.WINDOWS.createTarget(['nsis','zip'],Arch.x64)));
  const entries=files.filter(v=>/\.(exe|zip)$/.test(v)).map(file=>({name:path.basename(file),bytes:fs.statSync(file).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({sourceCommit:commit,info,artifacts:entries},null,2)+'\n');
  fs.writeFileSync(path.join(out,'SHA256SUMS'),entries.map(v=>v.sha256+'  '+v.name).join('\n')+'\n');
  console.log(JSON.stringify({directory:out,sourceCommit:commit,artifacts:entries}));
 }finally{fs.rmSync(work,{recursive:true,force:true});}
}
module.exports={screenShareConfiguration,screenShareBuildOptions,main};
if(require.main===module)main().catch(()=>{console.error('CastLink screen sharing component packaging failed');process.exitCode=1;});
