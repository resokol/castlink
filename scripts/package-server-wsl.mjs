import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import tracks from './release-track.cjs';

export async function hashFile(file){
 const h=createHash('sha256');for await(const block of createReadStream(file))h.update(block);return h.digest('hex');
}

// Validate without extraction: an imported OS may contain absolute symlinks and
// device entries, but must not carry the producer's identity or an installation.
const audit=String.raw`
import hashlib,json,re,sys,tarfile
archive,version,commit,inventory_path,sources_path,upstream_path,upstream_manifest=sys.argv[1:]
required={'usr/lib/systemd/systemd','usr/lib/x86_64-linux-gnu/security/pam_systemd.so','usr/lib/systemd/user/dbus.socket',
          'usr/local/bin/node','usr/local/bin/caddy',
          'usr/local/bin/livekit-server','usr/local/bin/castlink-server',
          'opt/castlink/app/apps/web/server.js','etc/wsl.conf','opt/castlink/release.json','opt/castlink/packages.tsv'}
seen=set(); selected={}
with tarfile.open(archive,'r:gz') as source:
 for member in source:
  name=member.name.removeprefix('./').rstrip('/')
  if not name: continue
  if name.startswith('/') or '..' in name.split('/') or name in seen:
   raise ValueError('Unsafe or duplicate rootfs member')
  seen.add(name)
  parts=name.split('/')
  if any(p in ('.git','.aws','.codex','.agents','.env','.dockerenv','.containerenv') for p in parts):
   raise ValueError('Rootfs contains private producer data')
  if name in ('usr/bin/docker','usr/local/bin/docker','usr/bin/dockerd','usr/local/bin/dockerd') or name.startswith('var/lib/docker/'):
   raise ValueError('Docker is not allowed in the deployed WSL runtime')
  if ((name.startswith('var/lib/castlink-server/') and member.isfile()) or
      re.match(r'etc/ssh/ssh_host_.*_key$',name) or
      name in ('etc/machine-id','var/lib/dbus/machine-id') and member.size):
   raise ValueError('Rootfs contains private identity or installation secrets')
  if name in ('etc/wsl.conf','opt/castlink/release.json','opt/castlink/packages.tsv'):
   if not member.isfile() or member.size>1048576: raise ValueError('Invalid runtime metadata')
   selected[name]=source.extractfile(member).read().decode('utf-8')
 if required-seen: raise ValueError('Missing runtime/systemd files: '+','.join(sorted(required-seen)))
 value=json.loads(selected['opt/castlink/release.json'])
 if value.get('version')!=version or value.get('commit')!=commit or value.get('buildId')!=version+'-'+commit[:12]:
  raise ValueError('Embedded runtime release/version/commit mismatch')
 import configparser
 cfg=configparser.ConfigParser();cfg.read_string(selected['etc/wsl.conf'])
 if not cfg.getboolean('boot','systemd',fallback=False): raise ValueError('WSL systemd must be enabled')
 if cfg.getboolean('automount','enabled',fallback=True) or cfg.getboolean('interop','enabled',fallback=True):
  raise ValueError('WSL runtime must disable Windows drive mounts and interop')
with open(inventory_path,encoding='utf-8') as source: inventory=source.read()
if inventory!=selected['opt/castlink/packages.tsv']: raise ValueError('Package inventory differs from rootfs')
packages=set()
for row in inventory.splitlines():
 fields=row.split('\t')
 if len(fields)!=2 or not all(fields): raise ValueError('Invalid source inventory')
 packages.add(tuple(fields))
seen=set(); actual={}; dsc=set(); references={}; manifest=None
with tarfile.open(sources_path,'r:gz') as source:
 for member in source:
  name=member.name.removeprefix('./').rstrip('/')
  if name in ('','.'): continue
  if name.startswith('/') or '..' in name.split('/') or name in seen or not member.isfile():
   raise ValueError('Unsafe source archive member')
  seen.add(name)
  stream=source.extractfile(member)
  if name=='sources.json':
   if member.size>16*1024*1024: raise ValueError('Source manifest is too large')
   manifest=json.loads(stream.read());continue
  digest=hashlib.sha256(); size=0; header=bytearray()
  for chunk in iter(lambda:stream.read(1024*1024),b''):
   digest.update(chunk);size+=len(chunk)
   if name.endswith('.dsc') and len(header)<65536: header.extend(chunk[:65536-len(header)])
  actual[name]={'sha256':digest.hexdigest(),'size':size}
  if name.endswith('.dsc'):
   text=header.decode('utf-8'); n=re.search(r'^Source: (\S+)',text,re.M);v=re.search(r'^Version: (\S+)',text,re.M)
   if not n or not v: raise ValueError('Invalid source descriptor')
   dsc.add((n[1],v[1]))
   checksums=re.search(r'^Checksums-Sha256:\s*\n((?:[ \t]+[^\n]+\n?)+)',text,re.M)
   if not checksums: raise ValueError('Source descriptor has no SHA256 payload references')
   for row in checksums[1].splitlines():
    fields=row.split()
    if len(fields)!=3 or not re.fullmatch(r'[a-f0-9]{64}',fields[0]) or not fields[1].isdigit() or '/' in fields[2] or fields[2] in ('.','..'):
     raise ValueError('Invalid source descriptor checksum')
    value={'sha256':fields[0],'size':int(fields[1])}
    if fields[2] in references and references[fields[2]]!=value: raise ValueError('Conflicting source descriptor references')
    references[fields[2]]=value
if not manifest or manifest.get('schemaVersion')!=1 or manifest.get('files')!=actual:
 raise ValueError('Source archive inventory or checksum mismatch')
if {(p['name'],p['version']) for p in manifest.get('packages',[])}!=packages or not packages<=dsc:
 raise ValueError('Corresponding source versions differ from installed package inventory')
if any(actual.get(name)!=value for name,value in references.items()):
 raise ValueError('Missing or incorrect corresponding source payload referenced by descriptor')
with open(upstream_manifest,encoding='utf-8') as stream: expected=json.load(stream)
expected_files={item['path']:{'sha256':item['sha256'],'size':item['size']} for item in expected['files']}
upstream_actual={}; captured=None; seen=set()
with tarfile.open(upstream_path,'r:gz') as source:
 for member in source:
  name=member.name.removeprefix('./').rstrip('/')
  if name in ('','.'): continue
  if member.isdir(): continue
  if not member.isfile() or name in seen or name.startswith('/') or '..' in name.split('/'):
   raise ValueError('Unsafe upstream source archive')
  seen.add(name);stream=source.extractfile(member)
  if name=='README.txt': continue
  if name=='source-manifest.json':
   if member.size>16*1024*1024: raise ValueError('Upstream source manifest too large')
   captured=json.loads(stream.read());continue
  digest=hashlib.sha256();size=0
  for block in iter(lambda:stream.read(1024*1024),b''):digest.update(block);size+=len(block)
  upstream_actual[name]={'sha256':digest.hexdigest(),'size':size}
if captured!=expected or upstream_actual!=expected_files:
 raise ValueError('Upstream source archive differs from reviewed dependency manifest')
`;

async function readNativePanelPackage(root){
 const inventoryFile='server-native-panel-files.json';
 const inventory=JSON.parse(await fs.readFile(path.join(root,'scripts',inventoryFile),'utf8'));
 const names=[inventoryFile,...(inventory.files??[]),...(inventory.buildFiles??[])];
 if(inventory.schemaVersion!==1||inventory.host!=='CastLinkServer.exe'||inventory.binding!=='server-native-binding.json'||
    !Array.isArray(inventory.files)||!Array.isArray(inventory.buildFiles)||inventory.files.length!==6||inventory.buildFiles.length!==2||
    new Set(names).size!==names.length||names.some(name=>typeof name!=='string'||!/^[A-Za-z0-9][A-Za-z0-9.-]{0,127}$/.test(name)))throw Error('Invalid native panel helper inventory');
 for(const required of ['server-native-control.ps1','server-native-monitor.ps1','simple-easy-setup-control.ps1','simple-easy-setup-language.ps1','simple-easy-setup-network.ps1','simple-easy-setup-control.ico','server-native-panel-host.cs','build-server-native-panel-host.ps1'])
  if(!names.includes(required))throw Error('Missing native panel helper: '+required);
 const files=[];
 for(const file of names){
  const source=path.join(root,'scripts',file),stat=await fs.lstat(source);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size===0||stat.size>4194304)throw Error('Invalid native panel helper: '+file);
  files.push({file,sha256:await hashFile(source),size:stat.size});
 }
 return {schemaVersion:1,host:inventory.host,binding:inventory.binding,files};
}

export async function assembleWslPackage({root=process.cwd(),output,rootfs,sources,upstreamSources,inventory,commit,version,repository='resokol/castlink',python=process.env.CASTLINK_PYTHON||'python3'}){
 if(!/^[a-f0-9]{40}$/.test(commit??''))throw Error('Exact source commit required');
 if(!tracks.VERSION.test(version??''))throw Error('Valid product version required');
 if(!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(repository))throw Error('Invalid repository');
 if(!output||!rootfs||!sources||!upstreamSources||!inventory)throw Error('Rootfs, Ubuntu and upstream corresponding sources, package inventory and output required');
 output=path.resolve(output);
 try{await fs.lstat(output);throw Error('Destination already exists; choose a new package directory');}catch(e){if(e.code!=='ENOENT')throw e;}
 for(const file of [rootfs,sources,upstreamSources,inventory]){const s=await fs.lstat(file);if(!s.isFile()||s.isSymbolicLink()||s.size===0)throw Error('Missing or invalid rootfs/source/inventory');}
 execFileSync(python,['-c',audit,rootfs,version,commit,inventory,sources,upstreamSources,path.join(root,'distribution/third-party-sources.json')],{stdio:['ignore','pipe','pipe']});
 const nativePanel=await readNativePanelPackage(root);
 const rootfsName='CastLink-Server-WSL-amd64.tar.gz',sourcesName='CastLink-Server-WSL-Sources.tar.gz';
 const manifest={schemaVersion:1,channel:'server-wsl',version,releaseTag:`server-wsl-v${version}-${commit.slice(0,12)}`,repository,architecture:'amd64',sourceCommit:commit,
  rootfs:{file:rootfsName,sha256:await hashFile(rootfs),size:(await fs.stat(rootfs)).size},
  sources:{file:sourcesName,sha256:await hashFile(sources),size:(await fs.stat(sources)).size},
  upstreamSources:{file:'CastLink-ThirdParty-Sources.tar.gz',sha256:await hashFile(upstreamSources),size:(await fs.stat(upstreamSources)).size},
  inventory:{file:'packages.tsv',sha256:await hashFile(inventory)},
  nativePanel,
  requirements:{windowsBuild:22621,wsl:2,networkingMode:'mirrored',hostAddressLoopback:true},
  verification:{windowsInstall:'not-run',externalMedia:'not-run',publication:'not-published'}};
 const bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
 const pins={CASTLINK_WSL_RELEASE_TAG:manifest.releaseTag,CASTLINK_WSL_ROOTFS_SHA256:manifest.rootfs.sha256,CASTLINK_WSL_MANIFEST_SHA256:createHash('sha256').update(bytes).digest('hex'),CASTLINK_WSL_REPOSITORY:repository};
 let script=await fs.readFile(path.join(root,'scripts/install-server-windows.ps1'),'utf8');
 for(const [key,value] of Object.entries(pins)){const token='@'+key+'@';if(!script.includes(token))throw Error('Installer template token missing: '+key);script=script.replaceAll(token,value);}
 if(/@CASTLINK_[A-Z_]+@/.test(script))throw Error('Unknown installer template token');
 // All validation precedes destination creation; no existing files are adopted.
 await fs.mkdir(output,{recursive:false});
 await fs.copyFile(rootfs,path.join(output,rootfsName));await fs.copyFile(sources,path.join(output,sourcesName));
 await fs.copyFile(upstreamSources,path.join(output,manifest.upstreamSources.file));
 await fs.copyFile(inventory,path.join(output,'packages.tsv'));
 await fs.writeFile(path.join(output,'manifest.json'),bytes,{flag:'wx'});
 await fs.writeFile(path.join(output,'install-server-windows.ps1'),'\ufeff'+script.replace(/^\ufeff/,'').replace(/\r?\n/g,'\r\n'),{flag:'wx'});
 for(const entry of nativePanel.files)await fs.copyFile(path.join(root,'scripts',entry.file),path.join(output,entry.file));
 for(const name of ['LICENSE','THIRD_PARTY_NOTICES'])await fs.copyFile(path.join(root,name),path.join(output,name));
 const names=[rootfsName,sourcesName,manifest.upstreamSources.file,'packages.tsv','manifest.json','install-server-windows.ps1','LICENSE','THIRD_PARTY_NOTICES',...nativePanel.files.map(entry=>entry.file)];
 const sums=await Promise.all(names.map(async name=>(await hashFile(path.join(output,name)))+'  '+name));
 await fs.writeFile(path.join(output,'SHA256SUMS'),sums.join('\n')+'\n',{flag:'wx'});
 return manifest;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [output,rootfs,sources,upstreamSources,inventory,commit,version]=process.argv.slice(2);
 try{const manifest=await assembleWslPackage({output,rootfs,sources,upstreamSources,inventory,commit,version});console.log(JSON.stringify(manifest));}
 catch(error){console.error('WSL package refused: '+error.message);process.exitCode=1;}
}
