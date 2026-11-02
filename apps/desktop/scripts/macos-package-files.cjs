'use strict';
const fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {stagePackage}=require('./package-files.cjs');
function validateArch(arch){if(!['arm64','x64'].includes(arch))throw Error('Select macOS architecture arm64 or x64 explicitly');return arch;}
function validateBuildHost(platform,hostArch,targetArch){
  validateArch(targetArch);
  if(platform!=='darwin')throw Error('Build the macOS client on macOS');
  if(hostArch!==targetArch)throw Error(`Build on a native ${targetArch} macOS host; current Node architecture is ${hostArch}`);
}
function parseArguments(args){
  if(args.length!==2||args[0]!=='--arch')throw Error('Usage: node scripts/package-macos.cjs --arch <arm64|x64>');
  return {arch:validateArch(args[1])};
}
function readSourceCommit(root){
  const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  const commit=git(['rev-parse','HEAD']);
  if(!/^[a-f0-9]{40}$/.test(commit))throw Error('Exact source commit required');
  if(git(['status','--porcelain','--untracked-files=all']))throw Error('Commit the candidate before packaging: a clean source tree is required for exact provenance');
  return commit;
}
function artifactName(version,commit,arch,{distribution=false}={}){
  validateArch(arch);
  if(!/^[a-f0-9]{40}$/.test(commit))throw Error('Exact source commit required');
  return `CastLink-Client-${version}-${commit.slice(0,12)}-mac-${arch}${distribution===true?'':'-development'}.\${ext}`;
}
function stageMacPackage(root,destination,commit,arch,{distribution=false}={}){
  validateArch(arch);
  if(fs.existsSync(destination)&&fs.readdirSync(destination).length)throw Error('macOS staging directory must be empty');
  const shared=stagePackage(root,destination,commit);
  const info={...shared,platform:'darwin',arch,developmentCandidate:distribution!==true,portStatus:'incomplete',fullParity:false,
    minimumSystemVersion:'13.0.0',runtimeValidated:false,
    compatibilityNote:'Development floor is macOS 13 for the Electron 44 / ScreenCaptureKit port. Runtime compatibility is unverified; older systems are unsupported by this candidate.',
    systemAudio:false,presentationAudio:'none',floatingSlideControls:false,powerPointBridge:false,browserControl:false,
    remotePcCapture:false,remotePcInput:false,remoteControlBridge:false,remoteControlInputPolicy:false,
    serverSetup:false,updateChecks:true,manualUpdate:true,autoUpdate:false,signed:false,signing:'ad-hoc',notarized:false};
  const manifestPath=path.join(destination,'package.json'),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  manifest.description=distribution===true?'CastLink macOS client':'CastLink macOS development candidate (incomplete port)';
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(path.join(destination,'build-info.json'),JSON.stringify(info,null,2)+'\n');
  return info;
}
function completeMacPackage(stage,info,resources,pythonRuntime){
  for(const file of ['process-audio/CastLink.ProcessAudio','remote-input/CastLink.RemoteInput','window-slides/CastLink.WindowSlides','powerpoint/CastLink.PowerPointIdentity','powerpoint/PowerPoint.js','setup/manifest.json','setup/python/bin/python3','setup/python/runtime-manifest.json']){
    let valid=false;try{valid=fs.statSync(path.join(resources,file)).isFile();}catch{}
    if(!valid)throw Error('Missing required macOS resource: '+file);
  }
  const complete={...info,nativeHelpersBundled:true,portStatus:'awaiting-native-acceptance',
    presentationAudio:'powerpoint-process-only',floatingSlideControls:true,powerPointBridge:4,browserControl:true,
    remotePcCapture:1,remotePcInput:1,remoteControlBridge:1,remoteControlInputPolicy:2,serverSetup:true,pythonRuntime,
    acceptance:{powerPoint:'NOT VERIFIED',audioIsolation:'NOT VERIFIED',remoteInput:'NOT VERIFIED',serverSetup:'NOT VERIFIED'}};
  fs.writeFileSync(path.join(stage,'build-info.json'),JSON.stringify(complete,null,2)+'\n');
  return complete;
}
function createMacConfig(root,stage,out,info,arch,resources){
  validateArch(arch);
  const entitlements=path.join(root,'apps/desktop/build/entitlements.mac.plist');
  const distribution=info.developmentCandidate===false;
  return {extends:null,appId:'ru.castlink.client',productName:distribution?'CastLink Client':'CastLink Client Development',asar:true,npmRebuild:false,
    electronVersion:info.electron,directories:{app:stage,output:out},
    files:['src/*.cjs','ui/*','assets/*','package.json','build-info.json','LICENSE','THIRD_PARTY_NOTICES'],
    extraResources:resources?[{from:resources,to:'.',filter:['**/*']}]:[],publish:null,artifactName:artifactName(info.version,info.sourceCommit,arch,{distribution}),
    protocols:[{name:'CastLink invitation',schemes:info.nativeHelpersBundled?['castlink','castlink-remote','castlink-presenter','castlink-share']:['castlink']}],
    mac:{target:['dir','zip','dmg'],category:'public.app-category.productivity',identity:'-',hardenedRuntime:true,
      gatekeeperAssess:false,notarize:false,entitlements,entitlementsInherit:entitlements,minimumSystemVersion:'13.0.0',
      extendInfo:{NSCameraUsageDescription:'CastLink uses your camera when you choose to share video in a call.',
        NSMicrophoneUsageDescription:'CastLink uses your microphone when you choose to share audio in a call.',
        NSScreenCaptureUsageDescription:'CastLink shares the screen or window you choose during a call.',
        NSAppleEventsUsageDescription:'CastLink controls the PowerPoint presentation you explicitly select.'}},
    dmg:{sign:false}};
}
function createMacBuildOptions(desktop,work,config,targets){
  // Builder 26 auto-loads electron-builder.yml when config is an object.
  // A separate file and empty resources directory prevent Windows defaults.
  const file=path.join(work,'macos-builder.json'),buildResources=path.join(work,'build-resources');
  fs.mkdirSync(buildResources,{recursive:true});
  if(fs.readdirSync(buildResources).length)throw Error('macOS build resources must be empty');
  fs.writeFileSync(file,JSON.stringify({...config,directories:{...config.directories,buildResources}},null,2)+'\n');
  return {projectDir:desktop,config:file,...(targets?{targets}:{}),publish:'never'};
}
module.exports={createMacBuildOptions,validateBuildHost,parseArguments,readSourceCommit,artifactName,stageMacPackage,completeMacPackage,createMacConfig};
