#!/usr/bin/env node
// Build locally or in private CI; this script never publishes or imports WSL.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';
import {assembleWslPackage} from './package-server-wsl.mjs';
import tracks from './release-track.cjs';

export function verifyBuildSource(root,commit){
 const git=args=>execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();
 if(git(['rev-parse','HEAD'])!==commit)throw Error('Claimed source commit differs from HEAD');
 if(git(['status','--porcelain','--untracked-files=all']))throw Error('Release build requires clean tracked and untracked build inputs');
}

async function run(args,{capture=false}={}){
 const child=spawn('docker',args,{stdio:['ignore',capture?'pipe':'inherit','inherit']});
 let bytes='';if(capture)child.stdout.setEncoding('utf8').on('data',chunk=>{bytes+=chunk;if(bytes.length>1024*1024)child.kill();});
 await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>code===0?resolve():reject(Error('Docker step failed: '+args[0])));});
 return bytes.trim();
}

async function main(){
 const [destination,commit,version]=process.argv.slice(2);
 if(!destination||!/^[a-f0-9]{40}$/.test(commit??'')||!tracks.VERSION.test(version??''))throw Error('Usage: build-server-wsl.mjs NEW_OUTPUT FULL_COMMIT VERSION');
 verifyBuildSource(process.cwd(),commit);
 const output=path.resolve(destination);
 await fs.mkdir(output,{recursive:false});
 const prefix='castlink-wsl-build-'+commit.slice(0,12),web=prefix+'-web',rootfs=prefix+'-rootfs',sources=prefix+'-sources';
 const secret=process.env.CODEX_PROXY_CERT?['--secret','id=proxy_ca,src='+process.env.CODEX_PROXY_CERT]:[];
 await run(['build','--platform','linux/amd64','-f','Dockerfile.web',...secret,'--build-arg','CASTLINK_SOURCE_COMMIT='+commit,'--build-arg','STUDIOLINK_RELEASE='+version+'-'+commit.slice(0,12),'--build-arg','CASTLINK_PRODUCT_VERSION='+version,'--build-arg','CASTLINK_PRODUCT_BUILD_NUMBER='+version+'-'+commit.slice(0,12),'-t',web,'.']);
 const base=['build','--platform','linux/amd64','-f','infrastructure/server-wsl/Dockerfile',...secret,'--build-arg','WEB_IMAGE='+web,'--build-arg','CASTLINK_SOURCE_COMMIT='+commit,'--build-arg','CASTLINK_VERSION='+version];
 await run([...base,'--target','rootfs','-t',rootfs,'.']);
 // Check the actual installed versions against the same retained APT indexes
 // before exporting a large artifact or downloading corresponding sources.
 execFileSync(process.env.CASTLINK_PYTHON||'python3',['scripts/tests/server-wsl-source-closure.test.py','--image',rootfs],{stdio:'inherit'});
 const upstreamOutput=path.join(output,'upstream');
 const upstreamArgs=['scripts/package-third-party-sources.py','--cache',path.join(output,'source-cache'),'--output',upstreamOutput];
 if(process.env.CASTLINK_WSL_UPSTREAM_SOURCE_ARCHIVE)upstreamArgs.push('--reuse-archive',path.resolve(process.env.CASTLINK_WSL_UPSTREAM_SOURCE_ARCHIVE));
 execFileSync(process.env.CASTLINK_PYTHON||'python3',upstreamArgs,{stdio:'inherit'});
 const container=await run(['create',rootfs],{capture:true});
 try{
  // Include exact upstream copyright/NOTICE texts alongside the compiled binaries.
  await run(['cp',path.join(upstreamOutput,'third_party'),container+':/opt/castlink/third_party/components']);
  const archive=path.join(output,'rootfs.tar.gz');
  const child=spawn('docker',['export',container],{stdio:['ignore','pipe','inherit']});
  const filter=spawn(process.env.CASTLINK_PYTHON||'python3',['scripts/filter-server-wsl-rootfs.py'],{stdio:['pipe','pipe','inherit']});
  const closed=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>code===0?resolve():reject(Error('Rootfs export failed')));});
  const filtered=new Promise((resolve,reject)=>{filter.once('error',reject);filter.once('close',code=>code===0?resolve():reject(Error('Rootfs sanitization failed')));});
  await Promise.all([pipeline(child.stdout,filter.stdin),pipeline(filter.stdout,createWriteStream(archive,{flags:'wx'})),closed,filtered]);
  await run(['cp',container+':/opt/castlink/packages.tsv',path.join(output,'packages.tsv')]);
 }finally{await run(['rm',container]);}
 // Download exact source versions while the same APT indexes are available.
 await run([...base,'--target','sources','-t',sources,'.']);
 const sourceContainer=await run(['create',sources],{capture:true});
 try{await run(['cp',sourceContainer+':/opt/CastLink-Server-WSL-Sources.tar.gz',path.join(output,'sources.tar.gz')]);}
 finally{await run(['rm',sourceContainer]);}
 const manifest=await assembleWslPackage({output:path.join(output,'package'),rootfs:path.join(output,'rootfs.tar.gz'),sources:path.join(output,'sources.tar.gz'),upstreamSources:path.join(upstreamOutput,'CastLink-ThirdParty-Sources.tar.gz'),inventory:path.join(output,'packages.tsv'),commit,version});
 console.log('Private WSL artifacts prepared: '+manifest.releaseTag+'. Windows install and external media remain unverified; no release was published.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
