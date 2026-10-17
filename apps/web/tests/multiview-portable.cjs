const assert = require('node:assert/strict');
require('./multiview-layout.cjs');
const fs = require('node:fs');
const path = require('node:path');
assert.ok(fs.existsSync(path.join(__dirname,'../lib/multiview-portable.ts')),'Portable scene helpers must exist');
const {exportMultiviewScene,importMultiviewScene,MAX_PORTABLE_SCENE_BYTES} = require('../lib/multiview-portable.ts');
const tile = {id:'tile',sourceIdentity:'guest-secret-binding',source:'screen',x:-.25,y:.75,width:1.5,height:.5,fit:'contain',muted:true,borderRadius:30,transform:{zoom:2}};
const scene = {id:'scene',name:'Main',width:1920,height:1080,revision:4,tiles:[tile,{...tile,id:'second'}],absence:{mode:'black'}};
const exported = exportMultiviewScene(scene);
assert.equal(typeof exported,'string');
const envelope = JSON.parse(exported);
assert.equal(envelope.format,'castlink-multiview'); assert.equal(envelope.version,1);
assert.ok(!exported.includes('guest-secret-binding'),'Participant identities are not exported');
assert.deepEqual(scene.tiles[0],tile,'Export never modifies the draft');
const imported = importMultiviewScene(exported,()=> 'fresh');
assert.notEqual(imported.id,scene.id); assert.equal(imported.revision,0);
assert.equal(imported.name,scene.name); assert.equal(imported.tiles[0].x,-.25); assert.equal(imported.tiles[0].borderRadius,30);
assert.equal(new Set([imported.id,...imported.tiles.map(t=>t.id)]).size,3,'Repeating ID providers still produce unique IDs');
assert.ok(imported.tiles.every(t=>t.sourceIdentity==='' && !scene.tiles.some(old=>old.id===t.id)));
imported.tiles[0].transform.zoom=4; assert.equal(tile.transform.zoom,2);
const withBindings = {...envelope,scene};
assert.ok(importMultiviewScene(JSON.stringify(withBindings)).tiles.every(t=>t.sourceIdentity===''),'Import always clears source bindings');
for (const input of ['', 'null', '[]', '{', JSON.stringify(scene), JSON.stringify({...envelope,version:2}), JSON.stringify({...envelope,token:'secret'}), JSON.stringify({...envelope,scene:{...scene,password:'secret'}}), JSON.stringify({...envelope,scene:{...scene,tiles:[{...tile,width:-1}]}})]) {
  assert.throws(()=>importMultiviewScene(input),undefined,input.slice(0,80));
}
assert.equal(MAX_PORTABLE_SCENE_BYTES,131072);
assert.throws(()=>importMultiviewScene(' '.repeat(MAX_PORTABLE_SCENE_BYTES+1)),/размер|КБ/i);
// UTF-8 bytes, not JS code units, define the file limit.
assert.throws(()=>importMultiviewScene('中'.repeat(45000)),/размер|КБ/i);
assert.throws(()=>exportMultiviewScene({...scene,credentials:{token:'secret'}}));
assert.throws(()=>importMultiviewScene(exported,()=> 'invalid!'));
console.log('PASS: versioned portable scene round trip, detached bindings, fresh IDs, strict schema and UTF-8 size bounds');
