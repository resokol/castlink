'use strict';
// Private working-tree candidate only. The stable packaging/release path is unchanged.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {stagePackage}=require('./package-files.cjs');
const {buildProcessAudio}=require('./build-process-audio.cjs');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const LAUNCHERS={'Run Client.cmd':'','Run Helper.cmd':'--presentation-helper','Run Helper Localhost Test.cmd':'--presentation-helper --presentation-helper-allow-loopback-test'};
function launcherText(flags){return ['@echo off','setlocal','set "CastLinkTestExe=%~dp0CastLink PPTX Test.exe"','if not exist "%CastLinkTestExe%" set "CastLinkTestExe=%~dp0win-unpacked\\CastLink PPTX Test.exe"','if not exist "%CastLinkTestExe%" exit /b 1',...(!flags?['set "CASTLINK_PRIVATE_TEST_AUTH_FILE=%~dp0private-test-auth.json"']:[]),'start "" "%CastLinkTestExe%"'+(flags?' '+flags:''),''].join('\r\n');}
function writeLaunchers(directory){fs.mkdirSync(directory,{recursive:true});for(const [name,flags] of Object.entries(LAUNCHERS))fs.writeFileSync(path.join(directory,name),launcherText(flags),'ascii');}
function writePrivateAuth(directory,{source,origin}={}){
  if(!source)return false;
  let owner;
  try{owner=JSON.parse(fs.readFileSync(source,'utf8'));if(!owner||typeof owner!=='object')throw Error();}
  catch{throw Error('Could not read private test credentials');}
  const file=path.join(directory,'private-test-auth.json');
  fs.writeFileSync(file,JSON.stringify({origin,username:owner.basicUser,password:owner.basicPassword})+'\n',{mode:0o600});
  if(!require('../src/private-test-basic-auth.cjs').readPrivateTestAuth(file)){fs.rmSync(file);throw Error('Invalid private test Basic configuration');}
  fs.writeFileSync(path.join(directory,'PRIVATE-TEST-README.txt'),['PRIVATE TEST ONLY - contains shared website Basic credentials. Do not publish or forward this folder.','Run Client.cmd, enter '+origin+'/Studio2 as the server, and connect to Studio.','The sidecar private-test-auth.json grants website entry only; the Studio owner password is supplied separately.','Run Helper.cmd: enter '+origin+' and the pairing code shown by Load PPTX in the browser.','PowerPoint runtime is unverified on this PC: Office is unavailable. No Office installation is included.',''].join('\r\n'),'utf8');
  return true;
}
function inventory(directory,relative=''){
  const files=[];
  for(const name of fs.readdirSync(path.join(directory,relative)).sort()){
    const file=path.posix.join(relative,name),source=path.join(directory,file);
    if(fs.lstatSync(source).isDirectory())files.push(...inventory(directory,file));
    else if(!['build-info.json','snapshot-files.json'].includes(file))files.push({file,sha256:digest(fs.readFileSync(source))});
  }
  return files;
}
function stagePrivatePackage(root,destination,commit,{sourceDirty=true}={}){
  const base=stagePackage(root,destination,commit);
  const native=path.join(destination,'native-resources/powerpoint');fs.mkdirSync(native,{recursive:true});
  fs.copyFileSync(path.join(root,'native/windows-powerpoint/Control.ps1'),path.join(native,'Control.ps1'));
  const manifest=JSON.parse(fs.readFileSync(path.join(destination,'package.json')));
  manifest.name='castlink-pptx-private-test';manifest.version=base.version+'-pptx-test';manifest.description='CastLink private native PPTX test candidate';
  fs.writeFileSync(path.join(destination,'package.json'),JSON.stringify(manifest,null,2)+'\n');
  const files=inventory(destination);
  const info={...base,packagingScriptSha256:digest(fs.readFileSync(__filename)),track:'pptx-private-test',version:manifest.version,buildNumber:manifest.version+'-'+commit.slice(0,12),testBuild:true,sourceKind:'working-tree-snapshot',sourceDirty,sourceSnapshotSha256:digest(JSON.stringify(files)),updateChecks:false,manualUpdate:false,serverSetup:false,protocolRegistration:false,presentationAudio:fs.existsSync(path.join(destination,'native-resources/process-audio/CastLink.ProcessAudio.exe'))?'powerpoint-process-only':'unavailable',nativeAudioSourceSha256:digest(fs.readFileSync(path.join(root,'native/windows-process-audio/ProcessAudio.cs')))};
  fs.writeFileSync(path.join(destination,'snapshot-files.json'),JSON.stringify(files,null,2)+'\n');
  fs.writeFileSync(path.join(destination,'build-info.json'),JSON.stringify(info,null,2)+'\n');
  return info;
}
function privateBuilderConfig({stage,output,electron}){
  const extraResources=[{from:path.join(stage,'native-resources/powerpoint'),to:'powerpoint'}];
  if(fs.existsSync(path.join(stage,'native-resources/process-audio')))extraResources.push({from:path.join(stage,'native-resources/process-audio'),to:'process-audio'});
  return{extraFiles:[{from:path.join(stage,'launchers'),to:'.'}],extends:null,appId:'ru.castlink.pptx-test',productName:'CastLink PPTX Test',asar:true,protocols:[],publish:null,npmRebuild:false,electronVersion:electron,directories:{app:stage,output},files:['src/*.cjs','ui/*','assets/*','package.json','build-info.json','snapshot-files.json','LICENSE','THIRD_PARTY_NOTICES'],extraResources,artifactName:'CastLink-PPTX-Private-Test-win-x64.${ext}',win:{icon:'assets/castlink-icon.ico',target:['dir','zip'],signAndEditExecutable:false}};
}
async function main(){
  if(process.platform!=='win32')throw Error('Build the private Windows candidate on Windows');
  const root=path.resolve(__dirname,'../../..'),desktop=path.resolve(__dirname,'..');
  const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const sourceDirty=!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim();
  const stage=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-pptx-private-package-'));
  try{
    buildProcessAudio(root,path.join(stage,'native-resources/process-audio/CastLink.ProcessAudio.exe'));
    const info=stagePrivatePackage(root,stage,commit,{sourceDirty});
    const out=path.join(root,'artifacts/pptx-private-test',info.sourceSnapshotSha256.slice(0,16)+'-'+info.packagingScriptSha256.slice(0,8));
    if(fs.existsSync(out))throw Error('Private candidate output already exists; preserve it or choose a new snapshot');
    const {build,Platform,Arch}=require('electron-builder');
    // An object config is merged with auto-discovered electron-builder.yml.
    // A concrete independent JSON config prevents inheriting stable protocols/NSIS.
    writeLaunchers(path.join(stage,'launchers'));
    const authOptions={source:process.env.CASTLINK_PRIVATE_TEST_AUTH_SOURCE,origin:process.env.CASTLINK_PRIVATE_TEST_AUTH_ORIGIN};
    const hasPrivateAuth=writePrivateAuth(path.join(stage,'launchers'),authOptions);
    const configFile=path.join(stage,'private-builder.json');
    fs.writeFileSync(configFile,JSON.stringify(privateBuilderConfig({stage,output:out,electron:info.electron}),null,2));
    await build({projectDir:desktop,config:configFile,targets:Platform.WINDOWS.createTarget(['dir','zip'],Arch.x64),publish:'never'});
    writeLaunchers(out);
    if(hasPrivateAuth)for(const file of ['private-test-auth.json','PRIVATE-TEST-README.txt'])fs.copyFileSync(path.join(stage,'launchers',file),path.join(out,file));
    fs.copyFileSync(path.join(stage,'build-info.json'),path.join(out,'manifest.json'));
    fs.copyFileSync(path.join(stage,'snapshot-files.json'),path.join(out,'snapshot-files.json'));
    const sums=[];
    for(const name of fs.readdirSync(out).sort())if(/\.(zip|cmd)$/.test(name)||['manifest.json','snapshot-files.json'].includes(name))sums.push(digest(fs.readFileSync(path.join(out,name)))+'  '+name);
    fs.writeFileSync(path.join(out,'SHA256SUMS'),sums.join('\n')+'\n');
    console.log(JSON.stringify({output:out,executable:path.join(out,'win-unpacked/CastLink PPTX Test.exe'),sourceCommit:commit,sourceDirty,sourceSnapshotSha256:info.sourceSnapshotSha256,artifacts:sums}));
  }finally{fs.rmSync(stage,{recursive:true,force:true});}
}
module.exports={stagePrivatePackage,privateBuilderConfig,LAUNCHERS,launcherText,writePrivateAuth};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
