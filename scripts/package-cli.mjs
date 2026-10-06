#!/usr/bin/env node
// Offline developer packager. No downloads, signing, installation or release mode.
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {lstat, mkdir, readFile, readdir, writeFile, chmod} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

export const RUNTIMES = Object.freeze({
 'win32-x64': Object.freeze({artifact:'node-v22.23.3-win-x64.zip',sha256:'2b0ff57b049cda1bbcea2240eec20467018713c1efe1f7360c2681859b90ed71'}),
 'darwin-arm64': Object.freeze({artifact:'node-v22.23.3-darwin-arm64.tar.gz',sha256:'23b25245dcfb9af7262f8ff142e9e2e0af025368117329e7a7458a51e5922f53'}),
 'darwin-x64': Object.freeze({artifact:'node-v22.23.3-darwin-x64.tar.gz',sha256:'8a677b0219178efd6eb0e475457c4afb452b521a92f6e67845a73bd85727f2a8'}),
});
const MAX_FILE=128*1024*1024, MAX_CLI=16*1024*1024;
const semver=/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/;
const sha=value=>createHash('sha256').update(value).digest('hex');
function relative(name){if(typeof name!=='string'||!name||name.length>4096||/[:\\\x00-\x1f]/.test(name)||name.startsWith('/')||name.split('/').some(x=>!x||x==='.'||x==='..'))throw Error('Unsafe relative package path.');return name;}
async function noLinks(p){let cursor=path.resolve(p);for(;;){const s=await lstat(cursor);if(s.isSymbolicLink())throw Error('Refusing symlink in input/output path.');const next=path.dirname(cursor);if(next===cursor)break;cursor=next;}}
async function bytes(p,limit=MAX_FILE){await noLinks(p);const s=await lstat(p);if(!s.isFile()||s.size>limit)throw Error('Input must be a bounded regular file.');return readFile(p);}
async function digest(p){await noLinks(p);const s=await lstat(p);if(!s.isFile()||s.size>MAX_FILE)throw Error('Input must be a bounded regular file.');const h=createHash('sha256');for await(const b of createReadStream(p))h.update(b);return h.digest('hex');}
// Same duplicate-key boundary as CLI strict-json; kept package-only so the
// developer packager never executes the compiled payload it is inspecting.
function strictJson(data){
 const raw=data.toString('utf8');if(raw.includes('\uFFFD'))throw Error('Invalid JSON encoding.');const value=JSON.parse(raw),stack=[];
 for(const match of raw.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\],]/g)){
  const token=match[0];if(token==='{')stack.push({keys:new Set(),key:true});else if(token==='[')stack.push(null);else if(token==='}'||token===']')stack.pop();
  else{const current=stack.at(-1);if(!current)continue;if(token===',')current.key=true;else if(current.key){const key=JSON.parse(token);if(current.keys.has(key))throw Error('Duplicate JSON key.');current.keys.add(key);current.key=false;}}
 }
 return value;
}
function fields(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||Object.keys(value).some(k=>!keys.includes(k)))throw Error('Invalid server schema fields.');}
function arches(a){if(!Array.isArray(a)||!a.length||a.length>2||new Set(a).size!==a.length||a.some(x=>!['amd64','arm64'].includes(x)))throw Error('Invalid server architectures.');}
function serverManifest(m,architecture){
 fields(m,['schemaVersion','release','nodeVersion','architectures','images']);
 if(m.schemaVersion!==1||typeof m.release!=='string'||m.release.length>128||!semver.test(m.release)||m.nodeVersion!=='22.23.3')throw Error('Invalid server schema version/runtime.');
 arches(m.architectures);if(!m.architectures.includes(architecture))throw Error('Server architecture mismatch.');
 fields(m.images,['web','postgres','livekit','caddy']);for(const v of Object.values(m.images)){fields(v,['reference','architectures']);if(typeof v.reference!=='string'||v.reference.length>512||!/^[a-z0-9][a-z0-9._:/-]*@sha256:[a-f0-9]{64}$/.test(v.reference))throw Error('Server image requires pinned digest.');arches(v.architectures);if(m.architectures.some(x=>!v.architectures.includes(x)))throw Error('Server image architecture mismatch.');}
}
async function files(root,prefix=''){
 await noLinks(root);let result=[];const children=(await readdir(root,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name));
 for(const e of children){const n=relative(prefix+e.name),p=path.join(root,e.name);if(e.isSymbolicLink())throw Error('Refusing symlink in package files.');if(e.isDirectory())result.push(...await files(p,n+'/'));else if(e.isFile())result.push(n);else throw Error('Unsupported package file type.');if(result.length>4096)throw Error('Package file count exceeded.');}
 return result.sort();
}
async function put(root,name,data,mode=0o644){relative(name);const p=path.join(root,name);await mkdir(path.dirname(p),{recursive:true});await writeFile(p,data,{flag:'wx',mode});await chmod(p,mode);}
export function archiveInterpreter(platform=process.platform){return platform==='win32'?{command:'py',args:['-3']}:{command:'python3',args:[]};}
function archiveIO(args){const interpreter=archiveInterpreter();const r=spawnSync(interpreter.command,[...interpreter.args,fileURLToPath(new URL('./package-cli-archive.py',import.meta.url)),...args],{shell:false,encoding:'utf8',timeout:120000,maxBuffer:1024*1024});if(r.status!==0)throw Error('Archive preparation failed; partial development output requires diagnosis. Python 3 is required on the developer host (Windows: py -3; Unix: python3).');}

// Launcher hash pins this bootstrap before Node executes it. This verifies all payload
// bytes before importing main.js; it does not authenticate an altered launcher/root.
export function buildBootstrap(records){
 for(const [n,h] of Object.entries(records)){relative(n);if(!/^[a-f0-9]{64}$/.test(h))throw Error('Invalid integrity hash.');}
 return `import {readFileSync,lstatSync} from 'node:fs';\nimport path from 'node:path';\nimport {fileURLToPath} from 'node:url';\nimport {createHash} from 'node:crypto';\nconst root=path.dirname(fileURLToPath(import.meta.url));\nconst records=${JSON.stringify(records)};\ntry {\n for(const [name,expected] of Object.entries(records)){\n  let p=root;for(const part of name.split('/')){p=path.join(p,part);if(lstatSync(p).isSymbolicLink())throw Error();}\n  if(!lstatSync(p).isFile()||createHash('sha256').update(readFileSync(p)).digest('hex')!==expected)throw Error();\n }\n} catch {console.error('CastLink package integrity check failed.');process.exit(4);}\nprocess.argv=[process.argv[0],path.join(root,'cli/main.js'),...process.argv.slice(2)];\nawait import('./cli/main.js');\n`;
}
// Do not let inherited startup flags, module paths, caches or loader/config
// overrides run before the checked bootstrap or redirect its diagnostics.
const STARTUP_ENV=['NODE_OPTIONS','NODE_PATH','NODE_REPL_EXTERNAL_MODULE','NODE_EXTRA_CA_CERTS','NODE_ICU_DATA','NODE_COMPILE_CACHE','NODE_V8_COVERAGE','NODE_REDIRECT_WARNINGS','OPENSSL_CONF','OPENSSL_MODULES','LD_PRELOAD','LD_LIBRARY_PATH','DYLD_INSERT_LIBRARIES','DYLD_LIBRARY_PATH','DYLD_FRAMEWORK_PATH'];
export async function writeLaunchers(root,target,pins){
 if(!RUNTIMES[target]||!Object.values(pins).every(h=>/^[a-f0-9]{64}$/.test(h)))throw Error('Invalid launcher pins.');
 if(target==='win32-x64'){
  const check=(name,hash)=>`"%SystemRoot%\\System32\\certutil.exe" -hashfile "%~dp0..\\${name}" SHA256 2>nul | "%SystemRoot%\\System32\\findstr.exe" /x /c:"${hash}" >nul\r\nif errorlevel 1 goto integrity_failed\r\n`;
  await put(root,'bin/castlink.cmd',`@echo off\r\nsetlocal DisableDelayedExpansion\r\n${STARTUP_ENV.map(name=>`set "${name}="\r\n`).join('')}${check('runtime\\node.exe',pins.runtime)}${check('integrity.mjs',pins.bootstrap)}"%~dp0..\\runtime\\node.exe" "%~dp0..\\integrity.mjs" %*\r\nexit /b %errorlevel%\r\n:integrity_failed\r\necho CastLink package integrity check failed; certutil and findstr are required. 1>&2\r\nexit /b 4\r\n`);
 }else{
  await put(root,'bin/castlink',`#!/bin/sh\nunset ${STARTUP_ENV.join(' ')}\nROOT=$(CDPATH= cd -P "$(dirname "$0")/.." && pwd -P) || exit 4\nfail() { echo 'CastLink package integrity check failed; shasum is required.' >&2; exit 4; }\ncheck() {\n [ ! -L "$1" ] && [ -f "$1" ] || fail\n HASH=$(/usr/bin/shasum -a 256 "$1" 2>/dev/null) || fail\n [ "\${HASH%% *}" = "$2" ] || fail\n}\ncheck "$ROOT/runtime/bin/node" '${pins.runtime}'\ncheck "$ROOT/integrity.mjs" '${pins.bootstrap}'\nexec "$ROOT/runtime/bin/node" "$ROOT/integrity.mjs" "$@"\n`,0o755);
 }
}

export async function verifyPackage(root){
 await noLinks(root);const sums=(await bytes(path.join(root,'SHA256SUMS'),1024*1024)).toString();const listed=[];
 for(const line of sums.trimEnd().split('\n')){const m=/^([a-f0-9]{64})  (.+)$/.exec(line);if(!m)throw Error('Invalid package integrity inventory.');const n=relative(m[2]);if(listed.includes(n)||await digest(path.join(root,n))!==m[1])throw Error('Package integrity checksum mismatch.');listed.push(n);}
 if(JSON.stringify(listed.sort())!==JSON.stringify((await files(root)).filter(n=>n!=='SHA256SUMS')))throw Error('Package integrity inventory mismatch.');
 return true;
}

export async function packageCli(options){
 if(options.development!==true)throw Error('Explicit --development is required; release packaging is not implemented.');
 const {target,dist,serverManifest:serverPath,runtimeArchive,output}=options, runtime=RUNTIMES[target];if(!runtime)throw Error('Unsupported target.');
 const cliPackage=options.cliPackage??fileURLToPath(new URL('../apps/cli/package.json',import.meta.url));
 const pkg=strictJson(await bytes(cliPackage,64*1024));if(pkg.type!=='module'||typeof pkg.version!=='string'||pkg.version.length>128||!semver.test(pkg.version)||Object.keys(pkg.dependencies??{}).length)throw Error('CLI requires an ESM version and no unbundled runtime dependencies.');
 const serverBytes=await bytes(serverPath,64*1024),server=strictJson(serverBytes);serverManifest(server,target.endsWith('arm64')?'arm64':'amd64');
 const distFiles=await files(dist);if(!distFiles.includes('main.js')||distFiles.some(n=>!/^([a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.js$/.test(n)))throw Error('Unsupported compiled dist content; only JavaScript modules are packaged.');
 const contents={};let size=0;for(const n of distFiles){const b=await bytes(path.join(dist,n),MAX_CLI);size+=b.length;if(size>MAX_CLI)throw Error('Compiled dist size exceeded.');contents[n]=b;}
 if(await digest(runtimeArchive)!==runtime.sha256)throw Error('Pinned runtime archive checksum mismatch.');
 const destination=path.resolve(output);await noLinks(path.dirname(destination));
 try{await mkdir(destination,{mode:0o700});}catch(e){if(e.code==='EEXIST')throw Error('Output exists; refusing overwrite or partial output reuse.');throw Error('Cannot create development output.');}
 const rootName=`castlink-${pkg.version}-${target}`,root=path.join(destination,rootName);await mkdir(root);
 try{
  await mkdir(path.join(root,'runtime'));archiveIO(['extract',path.resolve(runtimeArchive),runtime.artifact.replace(/\.(zip|tar\.gz)$/,''),path.join(root,'runtime'),target]);
  await put(root,'cli/package.json',JSON.stringify({name:'@castlink/cli',version:pkg.version,private:true,type:'module'},null,2)+'\n');
  for(const [n,b] of Object.entries(contents))await put(root,'cli/'+n,b);
  await put(root,'server/release.json',serverBytes);
  await put(root,'THIRD_PARTY_NOTICES',`Node.js 22.23.3: https://nodejs.org/dist/v22.23.3/\nThe complete original aggregate Node.js license and third-party notices are preserved in runtime/LICENSE.\nDocker Desktop is not included. Server container images are not included; their redistribution rights and notices are unverified.\nCastLink project license: missing; this is an internal development package, not an approved redistribution release.\n`);
  await put(root,'DEVELOPMENT.txt',`DEVELOPMENT ONLY. No project license approval, signing, notarization or Windows/macOS acceptance proof.\nBundled CLI/runtime only; server images are not included. Setup may need network and artifact access.\nServer manifest release: ${server.release}. Manifest-only; image availability and installability are unverified.\nSHA-256 detects corruption against the supplied launcher integrity roots; it is not an authenticated signature.\nLauncher pins runtime and integrity.mjs before Node execution; bootstrap pins metadata and all other payload files.\nLauncher/bootstrap and SHA256SUMS are excluded from bootstrap records to avoid cycles; SHA256SUMS inventories every other file including launcher/bootstrap.\nDeveloper host requires Node and Python 3. Launcher requires standard OS shasum (macOS) or certutil/findstr (Windows), and fails closed if checks fail.\n`);
  const records={};for(const n of await files(root))records[n]=await digest(path.join(root,n));
  const metadata={schemaVersion:1,cliVersion:pkg.version,target,distribution:'development-only',projectLicense:'missing',signing:'unverified',platformAcceptance:'unverified',runtime:{version:'22.23.3',url:`https://nodejs.org/dist/v22.23.3/${runtime.artifact}`,sha256:runtime.sha256},server:{release:server.release,path:'server/release.json',sha256:sha(serverBytes),artifacts:'manifest-only'},files:records};
  await put(root,'cli-release.json',JSON.stringify(metadata,null,2)+'\n');records['cli-release.json']=await digest(path.join(root,'cli-release.json'));
  await put(root,'integrity.mjs',buildBootstrap(records));
  const runtimePath=target==='win32-x64'?'runtime/node.exe':'runtime/bin/node';await writeLaunchers(root,target,{runtime:records[runtimePath],bootstrap:await digest(path.join(root,'integrity.mjs'))});
  const all=await files(root),lines=[];for(const n of all)lines.push(`${await digest(path.join(root,n))}  ${n}`);await put(root,'SHA256SUMS',lines.join('\n')+'\n');await verifyPackage(root);
  const archive=path.join(destination,rootName+(target==='win32-x64'?'.zip':'.tar.gz'));archiveIO(['create',root,archive,target]);const archiveSha256=await digest(archive);await writeFile(archive+'.sha256',`${archiveSha256}  ${path.basename(archive)}\n`,{flag:'wx'});
  return {root,archive,archiveSha256,distribution:'development-only'};
 }catch(e){throw Error(`${e.message} Partial development output is retained; use a new output directory after diagnosis.`);}
}
async function main(args){
 if(args.length===1&&args[0]==='--help'){console.log('Developer only: node scripts/package-cli.mjs --development --target win32-x64|darwin-arm64|darwin-x64 --runtime-archive PATH --dist PATH --server-manifest PATH --output NEW_DIRECTORY [--cli-package PATH]');return;}
 const options={},names={'--target':'target','--runtime-archive':'runtimeArchive','--dist':'dist','--server-manifest':'serverManifest','--output':'output','--cli-package':'cliPackage'};
 for(let i=0;i<args.length;i++){const a=args[i];if(a==='--development'){if(options.development)throw Error('Duplicate flag.');options.development=true;}else if(names[a]&&args[i+1]&&!args[i+1].startsWith('--')){if(names[a] in options)throw Error('Duplicate flag.');options[names[a]]=args[++i];}else throw Error('Unknown or incomplete packaging flag.');}
 for(const k of ['target','runtimeArchive','dist','serverManifest','output'])if(!options[k])throw Error('Missing required packaging flags.');console.log(JSON.stringify(await packageCli(options),null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
