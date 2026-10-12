import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';

const noticeName=/^(licen[sc]e|copying|notice|copyright|third[-_]party[-_]notices?)(?:[._-].*)?$/i;
async function packageDirectory(name,from){
 for(const base of createRequire(path.join(from,'package.json')).resolve.paths(name)||[]){
  const directory=path.join(base,name);
  try{const metadata=JSON.parse(await fs.readFile(path.join(directory,'package.json'),'utf8'));if(metadata.name===name)return {directory:await fs.realpath(directory),metadata};}catch(error){if(error.code!=='ENOENT'&&error.code!=='ENOTDIR')throw error;}
 }
 return undefined;
}

/** Include notices for bundled browser libraries as well as traced server packages. */
export async function collectRuntimeLicenses(source,output){
 const web=path.join(source,'apps/web');
 const root=JSON.parse(await fs.readFile(path.join(web,'package.json'),'utf8'));
 const pending=Object.keys(root.dependencies||{}).map(name=>({name,from:web,optional:false}));
 const seen=new Set(),packages=[];
 await fs.mkdir(output,{recursive:true});
 while(pending.length){
  const {name,from,optional}=pending.shift();
  const found=await packageDirectory(name,from);
  if(!found){if(optional)continue;throw Error('Missing production dependency license input: '+name);}
  const {directory,metadata}=found;
  if(seen.has(directory))continue;seen.add(directory);
  const id=(metadata.name+'@'+metadata.version).replace(/[^a-zA-Z0-9@._+-]/g,'_');
  const notices=[];
  async function copyNotices(folder){
   for(const file of await fs.readdir(folder,{withFileTypes:true})){
    if(file.name==='node_modules')continue;
    const input=path.join(folder,file.name);
    if(file.isDirectory())await copyNotices(input);
    else if(file.isFile()&&noticeName.test(file.name)){
     const relative=path.relative(directory,input);const target=path.join(output,id,relative);
     await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(input,target);notices.push(relative.split(path.sep).join('/'));
    }
   }
  }
  await copyNotices(directory);
  packages.push({name:metadata.name,version:metadata.version,license:metadata.license||metadata.licenses||null,repository:metadata.repository||null,notices:notices.sort(),directory:id});
  const dependencies={...metadata.dependencies,...metadata.optionalDependencies};
  for(const dependency of Object.keys(dependencies))pending.push({name:dependency,from:directory,optional:Object.hasOwn(metadata.optionalDependencies||{},dependency)});
 }
 packages.sort((a,b)=>(a.name+'@'+a.version).localeCompare(b.name+'@'+b.version));
 await fs.writeFile(path.join(output,'packages.json'),JSON.stringify({schemaVersion:1,scope:'Production dependency graph including browser bundles; each component retains its own license.',packages},null,2)+'\n');
 return packages;
}
