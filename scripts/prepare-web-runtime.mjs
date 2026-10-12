import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {collectRuntimeLicenses} from './collect-runtime-licenses.mjs';

export async function assertRuntimeFiles(runtime){
 async function walk(directory){
  for(const file of await fs.readdir(directory,{withFileTypes:true})){
   const absolute=path.join(directory,file.name),relative=path.relative(runtime,absolute).split(path.sep).join('/');
   const parts=relative.split('/'),vendor=parts.includes('node_modules');
   const privateFile=parts.some(part=>['.git','.aws','.codex','.agents','.studiolink-data'].includes(part)||part.startsWith('.env')||part.endsWith('.env')||part.includes('.env.'));
   const original=!vendor&&(/\.(?:ts|tsx|map)$/.test(relative)||/^(?:apps\/web\/)?(?:app|components|lib|tests|docs)(?:\/|$)/.test(relative));
   if(privateFile||original)throw Error('Original application source or local data/private runtime/environment file: '+relative);
   if(file.isDirectory())await walk(absolute);
   else if(file.isSymbolicLink()){
    const target=path.resolve(directory,await fs.readlink(absolute));
    if(path.relative(runtime,target).startsWith('..')||path.isAbsolute(path.relative(runtime,target)))throw Error('private runtime symlink escapes package: '+relative);
   }
  }
 }
 await walk(runtime);
}

export const operatorScripts = [
 'setup-database-v1.mjs','setup-database-schema.mjs','control-plane-seed-transaction.mjs',
 'postgres-migrate.mjs','control-plane-migrate.mjs','control-plane-seed-default.mjs',
 'control-plane-register-node.mjs','postgres-import-rooms.mjs','super-admin-owner.mjs',
 'setup-owner-v1.mjs','setup-owner-protected.mjs','setup-observe-v1.mjs',
 'setup-observer-internal-v1.mjs','runtime-startup-observe-v1.mjs',
 'node-heartbeat.mjs','heartbeat-host-metrics.mjs','storage-backup.mjs','storage-restore.mjs',
 'server-profile-store.mjs','server-provision-vps.py','ubuntu-easy-setup-bootstrap.sh',
 'server-peer-request.mjs','server-provisioning.mjs','server-provisioning-ssh.mjs','server-provisioning-operator.mjs'
];

export async function prepareRuntime(runtime, source) {
 runtime=path.resolve(runtime);source=path.resolve(source);
 await fs.access(path.join(runtime,'apps/web/server.js'));
 await assertRuntimeFiles(runtime);
 for(const name of ['app','components','lib','tests','.studiolink-data','next.config.ts','tsconfig.json']) {
  try {await fs.lstat(path.join(runtime,'apps/web',name));} catch(error) {if(error.code==='ENOENT')continue;throw error;}
  throw Error('Original application source or local data found in runtime: '+name);
 }
 // Next tracing omits non-executable license notices. Preserve notices from
 // each traced dependency directory without copying its untraced source files.
 async function legalNotices(directory) {
  const relative=path.relative(runtime,directory);
  const sourceDirectory=path.join(source,relative);
  let originals=[];try{originals=await fs.readdir(sourceDirectory,{withFileTypes:true});}catch(error){if(error.code!=='ENOENT')throw error;}
  for(const file of originals)if(file.isFile() && /^(licen[sc]e|copying|notice)(?:[._-].*)?$/i.test(file.name))await fs.copyFile(path.join(sourceDirectory,file.name),path.join(directory,file.name));
  for(const file of await fs.readdir(directory,{withFileTypes:true}))if(file.isDirectory())await legalNotices(path.join(directory,file.name));
 }
 await legalNotices(runtime);
 // Standalone embeds its configuration and never compiles TypeScript at run time.
 // Next tracing also captures its optional config compiler; omit that build tool.
 const pnpmDirectory=path.join(runtime,'node_modules/.pnpm');
 for(const name of await fs.readdir(pnpmDirectory))if(name.startsWith('typescript@'))await fs.rm(path.join(pnpmDirectory,name),{recursive:true,force:true});
 for(const name of ['node_modules/.pnpm/node_modules/typescript','apps/web/node_modules/typescript'])await fs.rm(path.join(runtime,name),{force:true});
 await fs.mkdir(path.join(runtime,'scripts'),{recursive:true});
 for(const name of operatorScripts)await fs.copyFile(path.join(source,'scripts',name),path.join(runtime,'scripts',name));
 for(const name of ['control-plane','postgres']){
  const output=path.join(runtime,'infrastructure',name);await fs.mkdir(output,{recursive:true});
  for(const file of await fs.readdir(path.join(source,'infrastructure',name),{withFileTypes:true}))if(file.isFile()&&/^[0-9]{3}_[a-z0-9_]+\.sql$/.test(file.name))await fs.copyFile(path.join(source,'infrastructure',name,file.name),path.join(output,file.name));
 }
 await fs.copyFile(path.join(source,'LICENSE'),path.join(runtime,'LICENSE'));
 await fs.copyFile(path.join(source,'THIRD_PARTY_NOTICES'),path.join(runtime,'THIRD_PARTY_NOTICES'));
 await fs.mkdir(path.join(runtime,'distribution'),{recursive:true});await fs.copyFile(path.join(source,'distribution/README.md'),path.join(runtime,'distribution/README.md'));
 await collectRuntimeLicenses(source,path.join(runtime,'third_party/npm'));
 await assertRuntimeFiles(runtime);
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)await prepareRuntime(process.argv[2],process.argv[3]??process.cwd());
