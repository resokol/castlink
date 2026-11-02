'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const MAC_SETUP_SOURCE_FILES=Object.freeze(['LICENSE','THIRD_PARTY_NOTICES','scripts/macos-compose-setup.py','scripts/linux-compose-setup.py','scripts/ubuntu-easy-setup-bootstrap.sh','scripts/server-provisioning-ssh.mjs','scripts/server-ssh-authorize-key.py']);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
// ssh2's optional cpu-features/sshcrypto native accelerators are deliberately
// excluded: packaged SSH uses its supported portable JavaScript implementation.
function stageMacSetupResources(root,destination,sourceCommit,{resolvePackage}={}){
 if(!/^[a-f0-9]{40}$/.test(sourceCommit))throw Error('Exact source commit required');
 const directory=path.join(destination,'setup');if(fs.existsSync(directory))throw Error('Setup resource destination already exists');
 const manifest={schemaVersion:1,platform:'darwin',sourceCommit,files:{},packages:{}};
 const staged=[];
 function put(relative,source){if(!fs.lstatSync(source).isFile())throw Error('Setup resource must be a regular file: '+relative);const bytes=fs.readFileSync(source);staged.push({relative,bytes});manifest.files[relative]={sha256:hash(bytes),size:bytes.length};}
 for(const relative of MAC_SETUP_SOURCE_FILES)put(relative,path.join(root,relative));
 const requireWeb=createRequire(path.join(root,'apps/web/package.json'));
 function resolve(name,from){return resolvePackage?resolvePackage(name,from):createRequire(from||requireWeb.resolve('ssh2/package.json')).resolve(name+'/package.json');}
 const visited=new Set();
 function dependency(name,from){
  if(!/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name))throw Error('Unsafe dependency name');
  const file=fs.realpathSync(resolve(name,from)),folder=path.dirname(file),pkg=JSON.parse(fs.readFileSync(file,'utf8'));
  if(pkg.name!==name||typeof pkg.version!=='string')throw Error('Invalid SSH dependency identity');
  if(visited.has(name)){if(manifest.packages[name]!==pkg.version)throw Error('Conflicting SSH dependency versions');return;}visited.add(name);manifest.packages[name]=pkg.version;
  function copy(current,relative){for(const entry of fs.readdirSync(current,{withFileTypes:true})){
   if(entry.name==='node_modules'||entry.name==='.git'||entry.name==='build'||entry.name==='test'||entry.name==='tests')continue;
   const source=path.join(current,entry.name),target=path.posix.join(relative,entry.name);if(entry.isSymbolicLink())throw Error('SSH dependency contains an unexpected symbolic link');if(entry.isDirectory())copy(source,target);else if(entry.isFile()&&!/\.(node|o|a)$/.test(entry.name))put(target,source);
  }}
  copy(folder,'node_modules/'+name);
  for(const required of Object.keys(pkg.dependencies||{}))if(!Object.hasOwn(pkg.optionalDependencies||{},required))dependency(required,file);
 }
 dependency('ssh2',path.join(root,'apps/web/package.json'));
 fs.mkdirSync(directory,{recursive:true});
 for(const {relative,bytes} of staged){const file=path.join(directory,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);}
 fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 return {directory,manifest,resources:Object.keys(manifest.files)};
}
module.exports={MAC_SETUP_SOURCE_FILES,stageMacSetupResources};
