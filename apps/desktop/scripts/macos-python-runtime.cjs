'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {execFileSync}=require('node:child_process');

// Immutable release metadata, including GitHub's SHA-256 asset digests:
// https://api.github.com/repos/astral-sh/python-build-standalone/releases/tags/20251031
// Keep the install tree intact: its licenses, dylibs, stdlib and relative links
// make the interpreter relocatable without Apple's Python or Command Line Tools.
const PYTHON_RELEASE='20251031';
const asset=(triple,sha256)=>Object.freeze({version:'3.12.12',sha256,url:`https://github.com/astral-sh/python-build-standalone/releases/download/${PYTHON_RELEASE}/cpython-3.12.12%2B${PYTHON_RELEASE}-${triple}-apple-darwin-install_only_stripped.tar.gz`});
const MAC_PYTHON_RUNTIMES=Object.freeze({
  arm64:asset('aarch64','2539a9105e47237aa8caabeed20587778f4acf9c6c4b3fe77f9bc2fd320720d2'),
  x64:asset('x86_64','10538a63ce7aa4d0891a3181150159fb5d3b750470a638ef8255a25dc50b9961')
});
const MAX_ARCHIVE_BYTES=64*1024*1024,MAX_TAR_BYTES=512*1024*1024;
function verifyArchiveChecksum(bytes,expected){
  if(!/^[a-f0-9]{64}$/.test(expected)||crypto.createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Python runtime archive SHA-256 mismatch');
}
function tarString(header,start,length){return header.subarray(start,start+length).toString('utf8').split('\0')[0];}
function tarNumber(header,start,length){
  const value=tarString(header,start,length).trim();
  if(!/^[0-7]*$/.test(value))throw Error('Unsupported tar numeric field');
  const number=parseInt(value||'0',8);if(!Number.isSafeInteger(number))throw Error('Unsafe tar numeric field');return number;
}
function memberPath(name){
  if(typeof name!=='string'||/[\\\x00-\x1f\x7f]/.test(name)||name.startsWith('/')||name.split('/').some(part=>part==='..'||part==='.'))throw Error('Unsafe Python archive path: '+name);
  const normalized=name.replace(/\/+$/,'');
  if(normalized!=='python'&&!normalized.startsWith('python/'))throw Error('Unsafe Python archive root: '+name);
  if(normalized.includes('//'))throw Error('Unsafe Python archive path: '+name);
  return normalized;
}
function linkPath(name,target){
  if(!target||target.startsWith('/')||/[\\\x00-\x1f\x7f]/.test(target))throw Error('Unsafe Python archive symbolic link: '+name);
  return memberPath(path.posix.normalize(path.posix.join(path.posix.dirname(name),target)));
}
function readArchive(bytes){
  if(bytes.length>MAX_ARCHIVE_BYTES)throw Error('Python runtime archive exceeds size limit');
  const tar=zlib.gunzipSync(bytes,{maxOutputLength:MAX_TAR_BYTES}),entries=new Map();let offset=0,ended=false;
  while(offset+512<=tar.length){
    const header=tar.subarray(offset,offset+512);offset+=512;
    if(header.every(byte=>byte===0)){ended=true;break;}
    let checksum=0;for(let i=0;i<512;i++)checksum+=i>=148&&i<156?32:header[i];
    if(checksum!==tarNumber(header,148,8))throw Error('Python runtime tar header checksum mismatch');
    const size=tarNumber(header,124,12),mode=tarNumber(header,100,8)&0o777;
    const prefix=tarString(header,345,155),name=memberPath((prefix?prefix+'/':'')+tarString(header,0,100));
    const type=tarString(header,156,1)||'0';
    if(!['0','2','5'].includes(type))throw Error('Unsupported Python archive entry type: '+type);
    if(entries.has(name))throw Error('Duplicate Python archive entry: '+name);
    if(offset+Math.ceil(size/512)*512>tar.length)throw Error('Truncated Python runtime tar payload');
    if(type!=='0'&&size!==0)throw Error('Unsafe Python archive link/directory payload');
    const link=type==='2'?tarString(header,157,100):null;
    entries.set(name,{name,type,mode,data:tar.subarray(offset,offset+size),link,target:type==='2'?linkPath(name,link):null});
    offset+=Math.ceil(size/512)*512;
    if(entries.size>20000)throw Error('Python runtime archive contains too many entries');
  }
  if(!ended)throw Error('Truncated Python runtime tar archive');
  // Validate the complete tree first. A link may never act as a parent of an
  // extracted member, so archive ordering cannot redirect a later file write.
  for(const name of [...entries.keys()]){
    let parent=path.posix.dirname(name);
    while(parent!=='.'){
      const entry=entries.get(parent);
      if(entry&&entry.type!=='5')throw Error('Unsafe Python archive symlink/file parent: '+parent);
      if(!entry)entries.set(parent,{name:parent,type:'5',mode:0o755});
      parent=path.posix.dirname(parent);
    }
  }
  function resolve(name,seen=new Set()){
    if(seen.has(name))throw Error('Python archive symbolic link cycle');
    const entry=entries.get(name);if(!entry)throw Error('Unsafe dangling Python archive symbolic link: '+name);
    if(entry.type!=='2')return;
    seen.add(name);resolve(entry.target,seen);
  }
  for(const entry of entries.values())if(entry.type==='2')resolve(entry.name);
  return entries;
}
function extractPythonArchive(bytes,destination){
  const entries=readArchive(bytes);
  if(fs.existsSync(destination))throw Error('Python extraction destination already exists');
  fs.mkdirSync(destination,{recursive:true});
  for(const entry of [...entries.values()].filter(item=>item.type==='5').sort((a,b)=>a.name.length-b.name.length)){
    const directory=path.join(destination,entry.name);fs.mkdirSync(directory,{recursive:true,mode:0o755});fs.chmodSync(directory,0o755);
  }
  for(const entry of entries.values())if(entry.type==='0'){
    const file=path.join(destination,entry.name);fs.writeFileSync(file,entry.data,{mode:entry.mode,flag:'wx'});fs.chmodSync(file,entry.mode);
  }
  for(const entry of entries.values())if(entry.type==='2')fs.symlinkSync(entry.link,path.join(destination,entry.name));
}
function validatePythonArchitecture(bytes,arch){
  if(bytes.length<32||bytes.readUInt32LE(0)!==0xfeedfacf)throw Error('Python interpreter must be a native 64-bit Mach-O executable');
  const expected={arm64:0x100000c,x64:0x1000007}[arch];
  if(!expected||bytes.readUInt32LE(4)!==expected)throw Error('Python interpreter architecture does not match '+arch);
}
function validatePythonIdentity(identity,arch,version){
  if(!Object.hasOwn(MAC_PYTHON_RUNTIMES,arch)||!identity||identity.system!=='Darwin'||identity.machine!=={arm64:'arm64',x64:'x86_64'}[arch])throw Error('Running Python interpreter architecture does not match macOS '+arch);
  if(identity.version!==version)throw Error('Running Python interpreter version does not match '+version);
}
async function downloadArchive(url,fetchImpl){
  const response=await fetchImpl(url,{signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw Error('Python runtime download failed: HTTP '+response.status);
  if(Number(response.headers.get('content-length'))>MAX_ARCHIVE_BYTES)throw Error('Python runtime archive exceeds size limit');
  if(!response.body)throw Error('Python runtime download returned an empty body');
  const chunks=[];let size=0;
  for await(const chunk of response.body){size+=chunk.length;if(size>MAX_ARCHIVE_BYTES)throw Error('Python runtime archive exceeds size limit');chunks.push(Buffer.from(chunk));}
  return Buffer.concat(chunks);
}
async function stageMacPythonRuntime({resourcesPath,arch,platform=process.platform,hostArch=process.arch,fetchImpl=globalThis.fetch,run=execFileSync}={}){
  if(!Object.hasOwn(MAC_PYTHON_RUNTIMES,arch))throw Error('Unsupported Python runtime architecture: '+arch);
  const pin=MAC_PYTHON_RUNTIMES[arch];
  if(platform!=='darwin')throw Error('Build the bundled Python runtime on macOS');
  if(hostArch!==arch)throw Error('Build the Python runtime on the native target architecture: '+arch);
  if(typeof resourcesPath!=='string'||!path.isAbsolute(resourcesPath))throw Error('Absolute macOS resourcesPath required');
  const setup=path.join(resourcesPath,'setup'),directory=path.join(setup,'python');
  if(fs.existsSync(directory))throw Error('Python runtime destination already exists');
  const bytes=await downloadArchive(pin.url,fetchImpl);verifyArchiveChecksum(bytes,pin.sha256);
  fs.mkdirSync(setup,{recursive:true});const work=fs.mkdtempSync(path.join(setup,'.python-stage-'));
  try{
    const extracted=path.join(work,'extracted');extractPythonArchive(bytes,extracted);
    const tree=path.join(extracted,'python'),binary=path.join(tree,'bin/python3'),license=path.join(tree,'lib/python3.12/LICENSE.txt');
    validatePythonArchitecture(fs.readFileSync(binary),arch);
    if(!fs.lstatSync(license).isFile()||fs.statSync(license).size<100)throw Error('Python runtime license is missing');
    const environment={...process.env};for(const key of Object.keys(environment))if(key.startsWith('PYTHON')||['DYLD_LIBRARY_PATH','DYLD_FRAMEWORK_PATH','DYLD_INSERT_LIBRARIES'].includes(key))delete environment[key];
    const identity=JSON.parse(run(binary,['-I','-B','-c','import json,platform,ssl,sqlite3,subprocess,urllib.request,pathlib; print(json.dumps(dict(version=platform.python_version(),machine=platform.machine(),system=platform.system())))'],{encoding:'utf8',timeout:30000,env:environment}).trim());
    validatePythonIdentity(identity,arch,pin.version);
    const manifest={schemaVersion:1,provider:'astral-sh/python-build-standalone',release:PYTHON_RELEASE,version:pin.version,platform:'darwin',arch,url:pin.url,sha256:pin.sha256,executable:'setup/python/bin/python3',license:'setup/python/lib/python3.12/LICENSE.txt',runtimeValidated:true};
    fs.writeFileSync(path.join(tree,'runtime-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    fs.renameSync(tree,directory);
    return {directory,executable:path.join(directory,'bin/python3'),manifest};
  }finally{fs.rmSync(work,{recursive:true,force:true});}
}
module.exports={PYTHON_RELEASE,MAC_PYTHON_RUNTIMES,stageMacPythonRuntime,verifyArchiveChecksum,extractPythonArchive,validatePythonArchitecture,validatePythonIdentity};
