import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';

export const UPDATER_FILES = Object.freeze({
 'castlink-updater.py':'scripts/updater/castlink-updater.py',
 'castlink-updater.ps1':'scripts/updater/castlink-updater.ps1',
 'linux-compose-setup.py':'scripts/linux-compose-setup.py',
 'install-updater-linux.sh':'scripts/updater/install-updater-linux.sh',
 'install-updater-windows.cmd':'scripts/updater/install-updater-windows.cmd',
 'LICENSE':'LICENSE',
});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function identity(commit,version){
 if(!/^[a-f0-9]{40}$/.test(commit??'')||!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version??''))throw Error('Full source SHA and canonical stable version required');
 return {schemaVersion:1,protocolVersion:1,channel:'updater',repository:'resokol/castlink',version,sourceCommit:commit,releaseTag:`updater-v${version}-${commit.slice(0,12)}`};
}
async function regular(file){
 const stat=await fs.lstat(file);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size<=0||stat.size>4*1024*1024)throw Error(`Invalid bounded tool file: ${path.basename(file)}`);
 return fs.readFile(file);
}
export async function assembleUpdaterPackage({root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),output,commit,version}){
 const manifest=identity(commit,version);if(!output)throw Error('New output directory required');
 output=path.resolve(output);
 try{await fs.lstat(output);throw Error('Output already exists');}catch(e){if(e.code!=='ENOENT')throw e;}
 const content=new Map();
 for(const [name,file] of Object.entries(UPDATER_FILES))content.set(name,await regular(path.join(root,file)));
 const entry=file=>({file,size:content.get(file).length,sha256:sha(content.get(file))});
 manifest.platforms={linux:{entry:'castlink-updater.py',files:['castlink-updater.py','linux-compose-setup.py'].map(entry)},windows:{entry:'castlink-updater.ps1',files:[entry('castlink-updater.ps1')]}};
 content.set('manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
 content.set('SHA256SUMS',Buffer.from([...content].sort(([a],[b])=>a.localeCompare(b,'en')).map(([n,b])=>`${sha(b)}  ${n}\n`).join('')));
 await fs.mkdir(output,{recursive:false});
 for(const [name,bytes] of content)await fs.writeFile(path.join(output,name),bytes,{flag:'wx',mode:name.endsWith('.sh')?0o755:0o644});
 return manifest;
}
export async function verifyUpdaterPackage({directory,commit,version}){
 const names=[...Object.keys(UPDATER_FILES),'manifest.json','SHA256SUMS'].sort();
 if(JSON.stringify((await fs.readdir(directory)).sort())!==JSON.stringify(names))throw Error('Unexpected or missing updater assets');
 const content=new Map();for(const name of names)content.set(name,await regular(path.join(directory,name)));
 const m=JSON.parse(content.get('manifest.json').toString('utf8')),expected=identity(commit,version);
 for(const [k,v] of Object.entries(expected))if(m[k]!==v)throw Error(`Updater identity differs: ${k}`);
 const platforms={linux:['castlink-updater.py','linux-compose-setup.py'],windows:['castlink-updater.ps1']};
 if(JSON.stringify(Object.keys(m.platforms??{}).sort())!==JSON.stringify(Object.keys(platforms)))throw Error('Updater platforms differ');
 for(const [p,files] of Object.entries(platforms)){
  if(m.platforms[p].entry!==files[0]||!Array.isArray(m.platforms[p].files)||JSON.stringify(m.platforms[p].files.map(e=>e.file).sort())!==JSON.stringify([...files].sort()))throw Error('Updater tool inventory differs');
  for(const e of m.platforms[p].files)if(e.size!==content.get(e.file).length||e.sha256!==sha(content.get(e.file)))throw Error('Updater tool hash differs');
 }
 const rows=content.get('SHA256SUMS').toString('ascii').trimEnd().split('\n'),seen=new Set();
 for(const row of rows){const match=/^([a-f0-9]{64})  ([A-Za-z0-9._-]+)$/.exec(row);if(!match||seen.has(match[2])||match[2]==='SHA256SUMS'||!content.has(match[2])||sha(content.get(match[2]))!==match[1])throw Error('Updater checksums differ');seen.add(match[2]);}
 if(seen.size!==names.length-1)throw Error('Incomplete updater checksums');
 return {manifest:m,assets:names.map(name=>({name,size:content.get(name).length,sha256:sha(content.get(name))}))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [output,commit,version='1.0.0']=process.argv.slice(2);
 await assembleUpdaterPackage({output,commit,version});await verifyUpdaterPackage({directory:output,commit,version});
 console.log('Verified complete updater package: '+output);
}
