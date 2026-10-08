// The same Linux image producer can run against Docker Desktop on a Windows runner.
import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {pipeline} from 'node:stream/promises';
import {createGzip} from 'node:zlib';
import {stockReferences,imageReferences} from './package-simple-easy-setup.mjs';
const [output,commit]=process.argv.slice(2);
if(!output||!/^[a-f0-9]{40}$/.test(commit??''))throw Error('Output folder and exact commit required');
fs.mkdirSync(output,{recursive:true});
const docker=(args,options={})=>execFileSync('docker',args,{stdio:'inherit',...options});
const tags=imageReferences(commit);
docker(['build','--platform','linux/amd64','-f','Dockerfile.web','--build-arg',`STUDIOLINK_RELEASE=1.0.0-rc.2-${commit.slice(0,12)}`,'-t',tags.web,'.']);
fs.writeFileSync(path.join(output,'web-id'),docker(['image','inspect',tags.web,'--format','{{.Id}}'],{encoding:'utf8',stdio:'pipe'}).trim());
const ids={};
for(const [name,reference] of Object.entries(stockReferences)){
 docker(['pull','--platform','linux/amd64',reference]);
 ids[name]=docker(['image','inspect',reference,'--format','{{.Id}}'],{encoding:'utf8',stdio:'pipe'}).trim();
 docker(['tag',reference,tags[name]]);
}
execFileSync(process.execPath,['scripts/tests/web-runtime-image.smoke.mjs',tags.web,tags.postgres],{stdio:'inherit'});
fs.writeFileSync(path.join(output,'official-ids.json'),JSON.stringify(ids));
const archive=path.join(output,'images.tar.gz');
const saved=spawn('docker',['save',...Object.values(tags)],{stdio:['ignore','pipe','inherit']});
const status=new Promise((resolve,reject)=>{saved.once('error',reject);saved.once('close',code=>code===0?resolve():reject(Error(`docker save exited ${code}`)));});
const copying=pipeline(saved.stdout,createGzip({level:1}),fs.createWriteStream(archive));
try{await Promise.all([status,copying]);}
catch(error){saved.kill();await Promise.allSettled([status,copying]);fs.rmSync(archive,{force:true});throw error;}
