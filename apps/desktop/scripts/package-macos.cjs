'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {createMacBuildOptions,validateBuildHost,parseArguments,readSourceCommit,stageMacPackage,completeMacPackage,createMacConfig}=require('./macos-package-files.cjs');
async function main(){
  const {arch}=parseArguments(process.argv.slice(2));
  validateBuildHost(process.platform,process.arch,arch);
  const {readMacSigningPolicy,applyMacSigningPolicy,verifyMacDistributionBundle}=require('./macos-signing.cjs');
  const signingPolicy=readMacSigningPolicy();
  const root=path.resolve(__dirname,'../../..'),desktop=path.resolve(__dirname,'..'),commit=readSourceCommit(root);
  const out=path.join(root,'artifacts/desktop',commit.slice(0,12),`mac-${arch}`);
  if(fs.existsSync(out)&&fs.readdirSync(out).length)throw Error(`Output directory must be empty: ${out}`);
  const work=fs.mkdtempSync(path.join(os.tmpdir(),`castlink-macos-${arch}-`)),stage=path.join(work,'app');
  try{
    const initial=stageMacPackage(root,stage,commit,arch),resources=path.join(work,'resources');
    require('./build-macos-native.cjs').buildMacNative({root,resourcesPath:resources,arch});
    fs.copyFileSync(path.join(root,'native/macos-presentation/PowerPoint.js'),path.join(resources,'powerpoint/PowerPoint.js'));
    require('./macos-setup-resources.cjs').stageMacSetupResources(root,resources,commit);
    const python=await require('./macos-python-runtime.cjs').stageMacPythonRuntime({resourcesPath:resources,arch});
    const info=completeMacPackage(stage,initial,resources,python.manifest);
    // Resolve the desktop-local builder; never inherit Windows resources or targets.
    const builder=require('electron-builder');
    const config=applyMacSigningPolicy(createMacConfig(root,stage,out,info,arch,resources),signingPolicy);
    const options=createMacBuildOptions(desktop,work,config,builder.Platform.MAC.createTarget(['dir','zip','dmg'],builder.Arch[arch]));
    const files=await builder.build(options);
    const manifestInfo=signingPolicy.distribution?{...info,...verifyMacDistributionBundle(path.join(out,arch==='arm64'?'mac-arm64':'mac',config.productName+'.app'),signingPolicy)}:info;
    if(readSourceCommit(root)!==commit)throw Error('Source commit changed during packaging');
    const archives=files.filter(file=>/\.(zip|dmg)$/.test(file));
    for(const extension of ['zip','dmg'])if(!archives.some(file=>file.endsWith(`.${extension}`)))throw Error(`macOS ${extension} artifact was not produced`);
    const hashes=archives.map(file=>`${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}  ${path.basename(file)}`);
    const manifest=JSON.stringify(manifestInfo,null,2)+'\n';
    fs.writeFileSync(path.join(out,'manifest.json'),manifest);
    hashes.push(`${crypto.createHash('sha256').update(manifest).digest('hex')}  manifest.json`);
    fs.writeFileSync(path.join(out,'SHA256SUMS'),hashes.join('\n')+'\n');
    if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`artifactDirectory=${out}\n`);
    console.log(JSON.stringify({output:out,artifacts:archives.map(file=>path.basename(file)),sourceCommit:commit,arch,developmentCandidate:true,signed:manifestInfo.signed,signing:manifestInfo.signing,notarized:manifestInfo.notarized}));
  }finally{fs.rmSync(work,{recursive:true,force:true});}
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={main};
