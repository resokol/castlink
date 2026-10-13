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
 const lk=JSON.parse(c.files['livekit.json']);
 assert.equal(lk.turn?.enabled,true);
 assert.equal(lk.turn.udp_port,3478);
 assert.equal(lk.turn.tls_port,undefined,'IP setup never claims trusted TLS443');
 assert.deepEqual(lk.turn.allow_restricted_peer_cidrs,['8.8.8.8/32']);
 assert.deepEqual([lk.turn.relay_range_start,lk.turn.relay_range_end],[30000,30031]);
 assert.equal(lk.rtc.udp_port,7882);
 assert.equal(lk.rtc.port_range_start,undefined);
 assert.ok(c.compose.services.livekit.ports.includes('3478:3478/udp'));
 assert.ok(c.compose.services.livekit.ports.includes('7882:7882/udp'));
 assert.ok(c.compose.services.livekit.ports.includes('30000-30031:30000-30031/udp'));
 for(const [name,limit] of [['web','512m'],['livekit','512m'],['postgres','256m'],['caddy','128m']]){
  const service=c.compose.services[name];assert.equal(service.mem_limit,limit);assert.equal(service.memswap_limit,limit);
  assert.deepEqual(service.logging,{driver:'json-file',options:{'max-size':'10m','max-file':'3'}});
 }
 assert.match(c.files['web.env'],/NODE_OPTIONS=--max-old-space-size=384/);
 assert.equal(c.compose.services.livekit.environment.GOMEMLIMIT,'384MiB');
 assert.deepEqual(c.compose.services.postgres.command,['postgres','-c','shared_buffers=64MB','-c','max_connections=50']);
 assert.match(c.files['web.env'],/CASTLINK_GUEST_RELAY_ENABLED=1/);
 assert.match(c.files['web.env'],/CASTLINK_TURN_TRANSPORT=udp/);
});
test('installed target discovery validates UUID Compose project and rejects external volumes',async()=>{
 const code=`import importlib.util,json\ns=importlib.util.spec_from_file_location('p',${JSON.stringify(script)});m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nc='a'*40\nx=m.configuration('8.8.8.8',{'schemaVersion':1,'commit':c,'images':{k:'castlink-easy-'+k+':'+c for k in ['web','postgres','livekit','caddy']}},'11111111-1111-4111-8111-111111111111')['compose']\nm.validate_compose(x,x['name'])\nx['volumes']['web-data']={'external':True}\ntry:m.validate_compose(x,x['name']);print('accepted')\nexcept ValueError:print('rejected')`;
 assert.equal((await execute('python3',['-c',code],{encoding:'utf8'})).stdout.trim(),'rejected');
});
test('new five-image release preserves IP-only UDP setup and recognizes only the optional TURN TLS service',async()=>{
 const code=`import importlib.util,json\ns=importlib.util.spec_from_file_location('p',${JSON.stringify(script)});m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nc='b'*40\nr={'schemaVersion':1,'commit':c,'images':{k:'castlink-easy-'+k+':'+c for k in ['web','postgres','livekit','caddy','turntls']}}\nx=m.configuration('8.8.4.4',r)['compose']\nassert set(x['services'])==set(m.SERVICES)\nx['services']['turn-tls']={'image':r['images']['turntls']}\nm.validate_compose(x,x['name'])\nx['services']['foreign']={'image':'foreign'}\ntry:m.validate_compose(x,x['name']);print('accepted')\nexcept ValueError:print('rejected')`;
 assert.equal((await execute('python3',['-c',code],{encoding:'utf8'})).stdout.trim(),'rejected');
});

test('VPS refuses Docker-published ports even when the host socket could bind',async()=>{
 const code=`import importlib.util,json\ns=importlib.util.spec_from_file_location('p',${JSON.stringify(script)});m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nclass S:\n def __enter__(self):return self\n def __exit__(self,*args):pass\n def bind(self,*args):pass\nm.socket.socket=lambda *args:S()\ndef docker(*args,**kwargs):\n if args[0]=='ps':return 'container-id'\n if args[0]=='inspect':return json.dumps([{'NetworkSettings':{'Ports':{'443/tcp':[{'HostIp':'0.0.0.0','HostPort':'443'}]}}}])\n raise Exception('unexpected mutation')\nm.docker=docker\ntry:m.ports_available();print('accepted')\nexcept ValueError as e:print(str(e))`;
 assert.match((await execute('python3',['-c',code],{encoding:'utf8'})).stdout,/occupied; existing services were preserved/);
});
test('VPS refuses a TURN UDP listener or relay port owned by another Docker project',async()=>{
 for(const port of [3478,7882,30000,30031]){
  const code=`import importlib.util,json\ns=importlib.util.spec_from_file_location('p',${JSON.stringify(script)});m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nclass S:\n def __enter__(self):return self\n def __exit__(self,*args):pass\n def bind(self,*args):pass\nm.socket.socket=lambda *args:S()\ndef docker(*args,**kwargs):\n if args[0]=='ps':return 'foreign-container'\n if args[0]=='inspect':return json.dumps([{'NetworkSettings':{'Ports':{'${port}/udp':[{'HostIp':'0.0.0.0','HostPort':'${port}'}]}}}])\n raise Exception('unexpected mutation')\nm.docker=docker\ntry:m.ports_available();print('accepted')\nexcept ValueError as e:print(str(e))`;
  assert.match((await execute('python3',['-c',code],{encoding:'utf8'})).stdout,/occupied; existing services were preserved/);
 }
});
test('resume permits its own published port and ignores unbound container declarations',async()=>{
 const code=`import importlib.util,json
s=importlib.util.spec_from_file_location('p',${JSON.stringify(script)});m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
project='castlink-easy-'+'1'*32
class S:
 def __init__(self,protocol):self.protocol=protocol
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def bind(self,address):
  if self.protocol==m.socket.SOCK_STREAM and address[1]==443:raise OSError('own listener')
m.socket.socket=lambda family,protocol:S(protocol)
def docker(*args,**kwargs):
 if args[0]=='ps':return 'own foreign'
 if args[0]=='inspect':return json.dumps([{'Config':{'Labels':{'com.docker.compose.project':project}},'NetworkSettings':{'Ports':{'443/tcp':[{'HostPort':'443'}],'7882/udp':None}}},{'Config':{'Labels':{'com.docker.compose.project':'other'}},'NetworkSettings':{'Ports':{'3478/udp':None}}}])
 raise AssertionError('unexpected Docker action')
m.docker=docker
m.ports_available(project)
print('accepted')`;
 assert.equal((await execute('python3',['-c',code],{encoding:'utf8'})).stdout.trim(),'accepted');
});
