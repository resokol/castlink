#!/usr/bin/env node
// Manual private Actions development proof only. Never signs or publishes a release.
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {RUNTIMES, packageCli, verifyPackage} from './package-cli.mjs';

const upstream='https://nodejs.org/dist/v22.23.3/';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function assertNative(target, host=process) {
 if (!RUNTIMES[target]) throw Error('Unsupported target.');
 if (`${host.platform}-${host.arch}`!==target) throw Error('A matching native runner is required; check the macOS runner architecture/availability.');
 if (host.version!=='v22.23.3') throw Error('Build Node must be exactly 22.23.3.');
}
export function verifyUpstreamChecksum(listing,target) {
 const runtime=RUNTIMES[target];
 if (!runtime) throw Error('Unsupported target.');
 const entries=listing.trim().split(/\r?\n/).filter(line=>line.endsWith(`  ${runtime.artifact}`));
 if (entries.length!==1 || entries[0]!==`${runtime.sha256}  ${runtime.artifact}`) throw Error('Pinned upstream checksum disagreement.');
}
export async function verifyArchiveChecksum(archive) {
 const digest=hash(await readFile(archive));
 if (await readFile(archive+'.sha256','utf8')!==`${digest}  ${path.basename(archive)}\n`) throw Error('Development archive checksum mismatch.');
 return digest;
}
async function download(url,limit) {
 const response=await fetch(url,{signal:AbortSignal.timeout(120000),redirect:'error'});
 if (!response.ok) throw Error('Pinned runtime download failed.');
 const chunks=[];let size=0;
 for await (const chunk of response.body) {
  size+=chunk.length;
  if (size>limit) throw Error('Pinned runtime download exceeds limit.');
  chunks.push(chunk);
 }
 return Buffer.concat(chunks);
}
function run(command,args,options={}) {
 const result=spawnSync(command,args,{shell:false,encoding:'utf8',timeout:120000,maxBuffer:1024*1024,...options});
 if (result.error || result.status!==0) throw Error('Developer archive extraction failed.');
}
export function invokeLauncher(target,launcher,cwd,env,spawn=spawnSync) {
 const options={cwd,env,shell:false,encoding:'utf8',timeout:30000};
 return target==='win32-x64'
  // cmd /c parses command text itself; preserve its quote wrapper verbatim.
  ? spawn(path.win32.join(env.SystemRoot,'System32/cmd.exe'),['/d','/s','/c',`""${launcher}" --help"`],{...options,windowsVerbatimArguments:true})
  : spawn(launcher,['--help'],options);
}
async function smoke(result,target,temp) {
 await verifyArchiveChecksum(result.archive); // Verify before OS extraction, then inventory before launch.
 const extraction=await mkdtemp(path.join(temp,'Пакет с пробелами 日本-'));
 if (target==='win32-x64') {
  run(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-Command',"Expand-Archive -LiteralPath $env:CASTLINK_CI_ARCHIVE -DestinationPath $env:CASTLINK_CI_EXTRACT -ErrorAction Stop"],{env:{...process.env,CASTLINK_CI_ARCHIVE:result.archive,CASTLINK_CI_EXTRACT:extraction}});
 } else run('/usr/bin/tar',['-xzf',result.archive,'-C',extraction]);
 const root=path.join(extraction,path.basename(result.root));
 await verifyPackage(root);
 const runtimeLicense=await readFile(path.join(result.root,'runtime/LICENSE'));
 if (!runtimeLicense.equals(await readFile(path.join(root,'runtime/LICENSE')))) throw Error('Original aggregate Node LICENSE changed during extraction.');
 const cwd=await mkdtemp(path.join(temp,'Внешний cwd 日本-'));
 const launcher=path.join(root,target==='win32-x64'?'bin/castlink.cmd':'bin/castlink');
 const env={...process.env,PATH:target==='win32-x64'?path.join(process.env.SystemRoot,'System32'):'/usr/bin:/bin',NODE_OPTIONS:'--castlink-benign-invalid-startup-option',NODE_PATH:'/nonexistent/castlink-benign-node-path'};
 const invoke=()=>invokeLauncher(target,launcher,cwd,env);
 const help=invoke();
 if (help.error || help.status!==0 || !help.stdout.includes('CastLink')) throw Error('Extracted native bundled-Node help smoke failed.');
 const manifestPath=path.join(root,'server/release.json'),original=await readFile(manifestPath);
 try {
  await writeFile(manifestPath,'CI integrity tamper fixture');
  const negative=invoke();
  if (negative.status!==4 || !negative.stderr.includes('integrity')) throw Error('Extracted native integrity negative smoke failed.');
 } finally { await writeFile(manifestPath,original); }
 await verifyPackage(root);
 return {archiveChecksum:'passed',extractedInventory:'passed',aggregateNodeLicense:'preserved',nativeBundledNodeHelp:'passed',noGlobalNodePath:'passed',unicodePathsOutsideCwd:'passed',tamperedServerManifest:'blocked-exit-4'};
}
async function main(args) {
 if (args.length!==2) throw Error('Usage: node scripts/ci-package-cli.mjs TARGET NEW_OUTPUT_DIRECTORY');
 const [target,output]=args;
 assertNative(target);
 const temp=process.env.RUNNER_TEMP;
 if (!temp || !path.isAbsolute(temp)) throw Error('An absolute RUNNER_TEMP is required.');
 const runtime=RUNTIMES[target];
 const listing=await download(upstream+'SHASUMS256.txt',1024*1024);
 verifyUpstreamChecksum(listing.toString('utf8'),target);
 const archiveBytes=await download(upstream+runtime.artifact,128*1024*1024);
 if (hash(archiveBytes)!==runtime.sha256) throw Error('Pinned runtime archive checksum mismatch.');
 const cache=await mkdtemp(path.join(temp,'castlink-runtime-'));
 const runtimeArchive=path.join(cache,runtime.artifact);
 await writeFile(runtimeArchive,archiveBytes,{flag:'wx'});
 const repo=fileURLToPath(new URL('../',import.meta.url));
 const result=await packageCli({development:true,target,runtimeArchive,dist:path.join(repo,'apps/cli/dist'),serverManifest:path.join(repo,'scripts/fixtures/ci-server-manifest.json'),output:path.resolve(output)});
 const checks=await smoke(result,target,temp);
 const proof={schemaVersion:1,distribution:'development-only',installable:false,serverManifest:'fake-digests-NOT-INSTALLABLE',target,nodeVersion:'22.23.3',sourceCommit:process.env.GITHUB_SHA??null,archive:path.basename(result.archive),archiveSha256:result.archiveSha256,checks,projectLicense:'missing',signing:'unverified',physicalMacMediaAcceptance:'unverified',fullSetupAcceptance:'unverified'};
 await writeFile(path.join(path.resolve(output),'DEVELOPMENT-CI-PROOF.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
 if (process.env.GITHUB_STEP_SUMMARY) {
  const {appendFile}=await import('node:fs/promises');
  await appendFile(process.env.GITHUB_STEP_SUMMARY,`Development-only ${target} archive and integrity/help smoke passed. Fixture server manifest is NOT INSTALLABLE. No signing, public release, setup/media acceptance or physical Mac acceptance.\n`);
 }
 console.log(JSON.stringify(proof,null,2));
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
