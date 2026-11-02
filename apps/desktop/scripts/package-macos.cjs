'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {createMacBuildOptions,validateBuildHost,parseArguments,readSourceCommit,stageMacPackage,createMacConfig}=require('./macos-package-files.cjs');
async function main(){
  const {arch}=parseArguments(process.argv.slice(2));
  validateBuildHost(process.platform,process.arch,arch);
  const root=path.resolve(__dirname,'../../..'),desktop=path.resolve(__dirname,'..'),commit=readSourceCommit(root);
  const out=path.join(root,'artifacts/desktop',commit.slice(0,12),`mac-${arch}`);
  if(fs.existsSync(out)&&fs.readdirSync(out).length)throw Error(`Output directory must be empty: ${out}`);
  const work=fs.mkdtempSync(path.join(os.tmpdir(),`castlink-macos-${arch}-`)),stage=path.join(work,'app');
  try{
    const info=stageMacPackage(root,stage,commit,arch);
    // Resolve the desktop-local builder; never inherit Windows resources or targets.
    const builder=require('electron-builder');
    const options=createMacBuildOptions(desktop,work,createMacConfig(root,stage,out,info,arch),builder.Platform.MAC.createTarget(['dir','zip','dmg'],builder.Arch[arch]));
    const files=await builder.build(options);
    if(readSourceCommit(root)!==commit)throw Error('Source commit changed during packaging');
    const archives=files.filter(file=>/\.(zip|dmg)$/.test(file));
    for(const extension of ['zip','dmg'])if(!archives.some(file=>file.endsWith(`.${extension}`)))throw Error(`macOS ${extension} artifact was not produced`);
    const hashes=archives.map(file=>`${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}  ${path.basename(file)}`);
    const manifest=JSON.stringify(info,null,2)+'\n';
    fs.writeFileSync(path.join(out,'manifest.json'),manifest);
    hashes.push(`${crypto.createHash('sha256').update(manifest).digest('hex')}  manifest.json`);
    fs.writeFileSync(path.join(out,'SHA256SUMS'),hashes.join('\n')+'\n');
    if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`artifactDirectory=${out}\n`);
    console.log(JSON.stringify({output:out,artifacts:archives.map(file=>path.basename(file)),sourceCommit:commit,arch,developmentCandidate:true,signed:false,signing:'ad-hoc',notarized:false}));
  }finally{fs.rmSync(work,{recursive:true,force:true});}
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={main};
