import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const script=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../server-provision-vps.py');
const run=promisify(execFile);
const execute=(file,args,options)=>run(file,args,{...options,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
test('VPS configuration uses isolated UUID scope and exact four image tags without pulls',async()=>{
 const code=`import importlib.util,json\ns=importlib.util.spec_from_file_location('p',${JSON.stringify(script)});m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nc='a'*40\nr={'schemaVersion':1,'commit':c,'images':{k:'castlink-easy-'+k+':'+c for k in ['web','postgres','livekit','caddy']}}\nx=m.configuration('8.8.8.8',r,'11111111-1111-4111-8111-111111111111')\nprint(json.dumps(x))`;
 const c=JSON.parse((await execute('python3',['-c',code],{encoding:'utf8'})).stdout);
 assert.equal(c.compose.name,'castlink-easy-11111111111141118111111111111111');
 assert.deepEqual(Object.keys(c.compose.services).sort(),['caddy','livekit','postgres','web']);
 assert.equal(c.compose.services.web.volumes[0],'web-data:/data');
 assert.equal(c.compose.services.web.image,'castlink-easy-web:'+ 'a'.repeat(40));
 assert.match(c.files['web.env'],/STUDIOLINK_TRANSFER_ORIGIN=https:\/\/8\.8\.8\.8/);
 assert.match(c.files.Caddyfile,/profile shortlived/);
 assert.doesNotMatch(c.files['web.env'],/SSH|PASSWORD_FROM_USER/);
});
test('installed target discovery validates UUID Compose project and rejects external volumes',async()=>{
 const code=`import importlib.util,json\ns=importlib.util.spec_from_file_location('p',${JSON.stringify(script)});m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nc='a'*40\nx=m.configuration('8.8.8.8',{'schemaVersion':1,'commit':c,'images':{k:'castlink-easy-'+k+':'+c for k in ['web','postgres','livekit','caddy']}},'11111111-1111-4111-8111-111111111111')['compose']\nm.validate_compose(x,x['name'])\nx['volumes']['web-data']={'external':True}\ntry:m.validate_compose(x,x['name']);print('accepted')\nexcept ValueError:print('rejected')`;
 assert.equal((await execute('python3',['-c',code],{encoding:'utf8'})).stdout.trim(),'rejected');
});

test('VPS refuses Docker-published ports even when the host socket could bind',async()=>{
 const code=`import importlib.util,json\ns=importlib.util.spec_from_file_location('p',${JSON.stringify(script)});m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nclass S:\n def __enter__(self):return self\n def __exit__(self,*args):pass\n def bind(self,*args):pass\nm.socket.socket=lambda *args:S()\ndef docker(*args,**kwargs):\n if args[0]=='ps':return 'container-id'\n if args[0]=='inspect':return json.dumps([{'NetworkSettings':{'Ports':{'443/tcp':[{'HostIp':'0.0.0.0','HostPort':'443'}]}}}])\n raise Exception('unexpected mutation')\nm.docker=docker\ntry:m.ports_available();print('accepted')\nexcept ValueError as e:print(str(e))`;
 assert.match((await execute('python3',['-c',code],{encoding:'utf8'})).stdout,/occupied; existing services were preserved/);
});
