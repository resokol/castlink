// The same Linux image producer can run against Docker Desktop on a Windows runner.
import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {pipeline} from 'node:stream/promises';
import {createGzip} from 'node:zlib';
import {stockReferences,imageReferences,turnTlsBaseReference} from './package-simple-easy-setup.mjs';
const [output,commit]=process.argv.slice(2);
if(!output||!/^[a-f0-9]{40}$/.test(commit??''))throw Error('Output folder and exact commit required');
fs.mkdirSync(output,{recursive:true});
const docker=(args,options={})=>execFileSync('docker',args,{stdio:'inherit',...options});
const tags=imageReferences(commit);
const product=JSON.parse(fs.readFileSync('package.json','utf8'));
const buildId=`${product.version}-${commit.slice(0,12)}`;

// Existing Windows checkouts may predate the fixed LF attributes. Refuse stale bytes.
const fixedRuntimeHelpers=["scripts/setup-database-v1.mjs", "scripts/setup-database-schema.mjs", "scripts/runtime-startup-observe-v1.mjs", "scripts/setup-observer-internal-v1.mjs", "scripts/control-plane-seed-transaction.mjs"];
for(const relative of fixedRuntimeHelpers){if(fs.readFileSync(relative).includes(13))throw Error(`Pinned Linux helper ${relative} must use canonical LF bytes; rematerialize the tracked file from Git before building.`);}

docker(['build','--platform','linux/amd64','-f','Dockerfile.web','--build-arg',`STUDIOLINK_RELEASE=${buildId}`,'-t',tags.web,'.']);
fs.writeFileSync(path.join(output,'web-id'),docker(['image','inspect',tags.web,'--format','{{.Id}}'],{encoding:'utf8',stdio:'pipe'}).trim());
const noticeContainer=docker(['create',tags.web],{encoding:'utf8',stdio:'pipe'}).trim();
try{docker(['cp',noticeContainer+':/app/third_party',path.join(output,'third_party')]);}
finally{docker(['rm',noticeContainer]);}
const ids={};
const turnBuild=['build','--platform','linux/amd64','-f','infrastructure/turn-tls/Dockerfile','-t',tags.turntls];
if(process.env.CODEX_PROXY_CERT) turnBuild.push('--secret',`id=proxy_ca,src=${process.env.CODEX_PROXY_CERT}`);
turnBuild.push('.');docker(turnBuild);
ids.turntls=docker(['image','inspect',tags.turntls,'--format','{{.Id}}'],{encoding:'utf8',stdio:'pipe'}).trim();
for(const [name,reference] of Object.entries(stockReferences)){
 docker(['pull','--platform','linux/amd64',reference]);
 ids[name]=docker(['image','inspect',reference,'--format','{{.Id}}'],{encoding:'utf8',stdio:'pipe'}).trim();
 docker(['tag',reference,tags[name]]);
}
execFileSync(process.execPath,['scripts/tests/turn-tls-image.smoke.mjs',tags.turntls],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/tests/web-runtime-image.smoke.mjs',tags.web,tags.postgres],{stdio:'inherit'});
fs.writeFileSync(path.join(output,'official-ids.json'),JSON.stringify(ids));
const archive=path.join(output,'images.tar.gz');
const saved=spawn('docker',['save',...Object.values(tags)],{stdio:['ignore','pipe','inherit']});
const status=new Promise((resolve,reject)=>{saved.once('error',reject);saved.once('close',code=>code===0?resolve():reject(Error(`docker save exited ${code}`)));});
const copying=pipeline(saved.stdout,createGzip({level:1}),fs.createWriteStream(archive));
try{await Promise.all([status,copying]);}
catch(error){saved.kill();await Promise.allSettled([status,copying]);fs.rmSync(archive,{force:true});throw error;}

execFileSync(process.env.CASTLINK_PYTHON||(process.platform==='win32'?'python':'python3'),['scripts/audit-release-artifacts.py','--image',archive,'--report',path.join(output,'artifact-audit.json')],{stdio:'inherit'});

// Sources are a separate optional asset, never part of the installer download.
const sourceManifest=JSON.parse(fs.readFileSync('distribution/third-party-sources.json','utf8'));
if(JSON.stringify(sourceManifest.imageReferences)!==JSON.stringify({...stockReferences,turntls:turnTlsBaseReference}))throw Error('Refresh third-party source manifest for changed images');
if(!fs.readFileSync('Dockerfile.web','utf8').includes(sourceManifest.nodeImage))throw Error('Refresh source manifest for changed Node image');
if(!fs.readFileSync('pnpm-lock.yaml','utf8').includes('@img/sharp-libvips-linux-x64@'+sourceManifest.sharpLibvips))throw Error('Refresh source manifest for changed libvips');
execFileSync(process.env.CASTLINK_PYTHON||(process.platform==='win32'?'python':'python3'),['scripts/package-third-party-sources.py','--cache',path.join(output,'source-cache'),'--output',output],{stdio:'inherit'});

// APT adds runtime dependencies beyond the pinned Node base image. Compare the
// actual source package/version inventory before accepting corresponding inputs.
const runtimeInventory=path.join(output,'runtime-debian-sources.tsv');
fs.writeFileSync(runtimeInventory,docker(['run','--rm','--network','none','--entrypoint','dpkg-query',tags.web,'-W','-f=${source:Package}\t${source:Version}\n'],{encoding:'utf8',stdio:'pipe'}));
execFileSync(process.env.CASTLINK_PYTHON||(process.platform==='win32'?'python':'python3'),['scripts/package-third-party-sources.py','--manifest','distribution/third-party-office-sources.json','--asset-name','CastLink-ThirdParty-Office-Sources.tar.gz','--baseline-manifest','distribution/third-party-sources.json','--runtime-inventory',runtimeInventory,'--cache',path.join(output,'source-cache'),'--output',output],{stdio:'inherit'});
