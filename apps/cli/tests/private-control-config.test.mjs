import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {configFixture,capability} from './private-control-fixture.mjs';
test('actual CONFIG helper reserves private empty control inode while publishing the exact schema2 receipt',()=>configFixture(f=>{
 const p=f.run();assert.equal(p.status,0,p.stdout+p.stderr);assert.equal(p.stderr,'');const file=f.control+'/config.json',before=fs.statSync(file);assert.equal(before.mode&511,384);assert.equal(before.uid,1000);assert.equal(before.size,0);assert.equal(fs.statSync(f.control).mode&511,448);assert.equal(fs.existsSync(f.control+'/state'),false);const receipt=JSON.parse(fs.readFileSync(f.root+'/receipt.json'));assert.equal(receipt.release.schemaVersion,2);assert.deepEqual(receipt.release.privateControl,capability);assert.equal(receipt.controlScope,f.scope);
 const bytes=fs.readFileSync(f.root+'/compose.yaml'),again=f.run(1,true);assert.equal(again.status,0,again.stdout+again.stderr);assert.equal(fs.statSync(file).ino,before.ino);assert.deepEqual(fs.readFileSync(f.root+'/compose.yaml'),bytes);assert.equal(fs.existsSync(f.scope+'/active'),false);
}));
test('a deleted private CONFIG attempt cannot regenerate root or control credentials',()=>configFixture(f=>{
 assert.equal(f.run().status,0);fs.rmSync(f.root,{recursive:true});fs.rmSync(f.control,{recursive:true});const p=f.run(1);assert.equal(p.status,4);assert.equal(fs.existsSync(f.root),false);assert.equal(fs.existsSync(f.control),false);assert.equal(fs.existsSync(f.scope+'/active'),true);
}));
test('schema2 cannot adopt a completed legacy stock receipt or rewrite its credentials',()=>configFixture(f=>{
 const release={...f.input.release,schemaVersion:1};delete release.privateControl;const stock={...f.input,release};delete stock.controlScope;
 // Remove the optional scope by writing a separate exact stock declaration.
 const patch={release,controlScope:undefined};assert.equal(f.run(0,false,patch).status,0);const old=fs.readFileSync(f.root+'/web.env');const p=f.run(1,true);assert.equal(p.status,4);assert.deepEqual(fs.readFileSync(f.root+'/web.env'),old);assert.equal(fs.existsSync(f.control),false);
}));
test('CONFIG physical root replacement during publication refuses and keeps original attempted authority',()=>configFixture(f=>{
 const inject=`const originalWrite=leaseFs.writeFileSync;leaseFs.writeFileSync=(fd,...args)=>{const out=originalWrite(fd,...args);if(typeof fd==='number'&&leaseFs.readlinkSync('/proc/self/fd/'+fd)===${JSON.stringify(f.root+'/receipt.json')}){leaseFs.renameSync(${JSON.stringify(f.root)},${JSON.stringify(f.root+'.displaced')});leaseFs.mkdirSync(${JSON.stringify(f.root)},{mode:448});for(const n of leaseFs.readdirSync(${JSON.stringify(f.root+'.displaced')}))leaseFs.copyFileSync(${JSON.stringify(f.root+'.displaced/')}+n,${JSON.stringify(f.root+'/')}+n)}return out;};`;
 const p=f.run(0,false,{},inject);assert.equal(p.status,4);assert.equal(p.stderr,'');assert.equal(fs.existsSync(f.scope+'/active/owner.json'),true);assert.equal(fs.existsSync(f.control+'/reservation.json'),false);assert.equal(fs.existsSync(f.scope+'/private-control-config-'+f.input.installationId+'.json'),true);
}));
