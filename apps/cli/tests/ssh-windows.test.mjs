import test from 'node:test';
import assert from 'node:assert/strict';
import {sshInvocation} from '../dist/executors/ssh.js';
const target={kind:'remote',host:'node.castlink.net',user:'root',port:22};
const command={executable:'id',args:['-u'],sensitive:false};
const windows={systemRoot:'C:\\Windows',profileDirectory:'D:\\GitHub\\SL\\studiolink\\profiles'};
test('Windows remote executor uses builtin absolute SSH and D-only known hosts and key despite clean PATH',()=>{
 const actual=sshInvocation(target,command,windows);
 assert.equal(actual.executable,'C:\\Windows\\System32\\OpenSSH\\ssh.exe');
 assert(actual.args.includes('UserKnownHostsFile="D:/GitHub/SL/studiolink/profiles/ssh/known_hosts"'));
 assert(actual.args.includes('D:\\GitHub\\SL\\studiolink\\profiles\\ssh\\id_ed25519'));
 assert.deepEqual(actual.args.slice(0,2),['-F','none']);
 assert(actual.args.includes('StrictHostKeyChecking=yes'));assert(actual.args.includes('BatchMode=yes'));
 assert.deepEqual(JSON.parse(Buffer.from(actual.input).toString()),{schemaVersion:1,executable:'id',args:['-u']});
});
test('Windows SSH rejects a relative or control-bearing profile path before process dispatch',()=>{
 for(const profileDirectory of ['profiles','D:\\bad\nprofile','D:\\base\\..\\other'])assert.throws(()=>sshInvocation(target,command,{...windows,profileDirectory}));
});
