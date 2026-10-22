'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {writePrivateAuth,launcherText}=require('../scripts/package-pptx-test.cjs');
const {readPrivateTestAuth}=require('../src/private-test-basic-auth.cjs');
test('private packaging includes only shared HTML Basic credentials; owner password is excluded',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-private-package-auth-'));
 try{
  const source=path.join(dir,'owner.json'),destination=path.join(dir,'package');fs.mkdirSync(destination);
  fs.writeFileSync(source,JSON.stringify({basicUser:'studio2',basicPassword:'shared-fixture',studioPassword:'OWNER-MUST-NOT-SHIP',room:'Studio2'}));
  assert.equal(writePrivateAuth(destination,{source,origin:'https://relay.castlink.ru:9443'}),true);
  const raw=fs.readFileSync(path.join(destination,'private-test-auth.json'),'utf8');
  assert.equal(raw.includes('OWNER-MUST-NOT-SHIP'),false);
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(),['origin','password','username']);
  assert.equal(readPrivateTestAuth(path.join(destination,'private-test-auth.json')).password,'shared-fixture');
  assert.match(launcherText(''),/set "CASTLINK_PRIVATE_TEST_AUTH_FILE=%~dp0private-test-auth.json"/);
  assert.doesNotMatch(launcherText('--presentation-helper'),/CASTLINK_PRIVATE_TEST_AUTH_FILE/);
  assert.equal(writePrivateAuth(destination),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('malformed owner source errors never reveal private input in packaging logs',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-malformed-private-'));
 try{
  const source=path.join(dir,'owner.json');
  fs.writeFileSync(source,'{"basicPassword":"SECRET-SENTINEL","studioPassword":"OWNER-SENTINEL",broken}');
  assert.throws(()=>writePrivateAuth(dir,{source,origin:'https://relay.castlink.ru:9443'}),error=>{
   assert.equal(error.message,'Could not read private test credentials');
   assert.doesNotMatch(error.message,/SENTINEL|basicPassword|studioPassword/);return true;
  });
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
