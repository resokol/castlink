// Actual child process / filesystem / lease fixture. Docker and HTTPS replies
// below are protocol adapters, not SQL, TLS, daemon, or host-reboot proof.
import fs from 'node:fs';
import path from 'node:path';
import {rootCertificates} from 'node:tls';
import {X509Certificate} from 'node:crypto';
import {fixture as retainedFixture} from './host-startup-runner-fixture.mjs';
export async function fixture(fn){return retainedFixture(async f=>{
 fs.unlinkSync(f.file);fs.unlinkSync(f.desiredFile);
 await f.change({sql:'complete'});
 const original=f.home+'/bin/docker-original';fs.renameSync(f.home+'/bin/docker',original);
 // Public packaged Node trust bytes, not an installed platform CA path or a
 // native trust-store change. This adapter still does not prove real TLS.
 const certificate=rootCertificates.find(value=>{const c=new X509Certificate(value);return c.ca&&Date.parse(c.validFrom)<=Date.now()&&Date.parse(c.validTo)>Date.now()});
 if(!certificate)throw Error('fixture public CA unavailable');
 const ca=Buffer.from(certificate.trim()+'\n');
 fs.writeFileSync(f.home+'/public-ca.pem',ca,{mode:0o600});
 const adapter=`#!${process.execPath}
const fs=require('node:fs'),cp=require('node:child_process'),a=process.argv.slice(2),r=JSON.parse(fs.readFileSync(process.env.FIXTURE_STATE));
function archive(name,b,mode){const h=Buffer.alloc(512);h.write(name);h.write(mode.toString(8).padStart(7,'0')+'\\0',100);h.write('0000000\\0',108);h.write('0000000\\0',116);h.write(b.length.toString(8).padStart(11,'0')+'\\0',124);h.write('00000000000\\0',136);h.fill(32,148,156);h.write('0',156);h.write('ustar\\0',257);h.write('00',263);h.write(h.reduce((x,y)=>x+y,0).toString(8).padStart(6,'0')+'\\0 ',148);return Buffer.concat([h,b,Buffer.alloc((512-b.length%512)%512),Buffer.alloc(1024)])}
if(a[0]==='inspect'&&a[1]==='--format'){const c=r.containers.find(c=>c.Id===a.at(-1));process.stdout.write(JSON.stringify({Id:c.Id,Image:c.Image,Running:c.Running}));}
else if(a[0]==='cp'&&a[1].endsWith('/root.crt'))process.stdout.write(archive('root.crt',fs.readFileSync(${JSON.stringify(f.home+'/public-ca.pem')}),384));
else if(a[0]==='cp'&&a[1].endsWith('/owner-invite.txt'))process.stdout.write(archive('owner-invite.txt',r.ownerMismatch?Buffer.from('PRIVATE_WRONG_OWNER'):fs.readFileSync(${JSON.stringify(f.descriptor.completion.ownerFile)}),384));
else{const p=cp.spawnSync(${JSON.stringify(original)},a,{input:fs.readFileSync(0),maxBuffer:2097152});process.stdout.write(p.stdout);process.stderr.write(p.stderr);process.exit(p.status??1)}
`;
 fs.writeFileSync(f.home+'/bin/docker',adapter,{mode:0o700});
 const generation={engine:f.descriptor.association.engine,endpoint:f.descriptor.association.endpoint,epoch:0,principal:process.getuid(),scope:f.scope};
 const request={schemaVersion:1,generation,completion:f.descriptor.completion};
 const tls=`import https from 'node:https';import fs from 'node:fs';import {EventEmitter} from 'node:events';import {Readable} from 'node:stream';
https.request=(url,options,callback)=>{const q=new EventEmitter();q.destroy=e=>{if(e)q.emit('error',e)};q.end=body=>{queueMicrotask(()=>{try{const r=JSON.parse(fs.readFileSync(process.env.FIXTURE_STATE));r.http??=[];r.http.push({url,method:options.method});fs.writeFileSync(process.env.FIXTURE_STATE,JSON.stringify(r));if(options.method!=='GET'||body||options.rejectUnauthorized!==true||!options.ca.equals(fs.readFileSync(${JSON.stringify(f.home+'/public-ca.pem')})))throw Error();const endpoint=new URL(url).pathname,value=endpoint==='/api/version'?{version:r.badVersion?'foreign':'1.0.0',buildId:'1.0.0',productVersion:'1.0.0'}:{needsSetup:r.sql!=='complete',deploymentModel:'self-hosted'};const s=Readable.from([Buffer.from(JSON.stringify(value))]);s.statusCode=200;callback(s)}catch(e){q.emit('error',e)}})};return q};`;
 const launchProducer=(patch={},prefix='')=>f.launch(`${tls}${prefix}const {produceHostController}=await import(${JSON.stringify(path.join(f.base,'host-startup-producer.js'))});try{console.log(JSON.stringify(await produceHostController(${JSON.stringify({...request,...patch})})))}catch{console.log('host-producer-unverified');process.exitCode=4}`);
 const run=(patch={},prefix='')=>launchProducer(patch,prefix).done;
 await fn({...f,request,runProducer:run,launchProducer});
})}
