const assert = require('node:assert/strict');
require('./multiview-layout.cjs');
const {validateMultiviewScene} = require('../lib/multiview.ts');
const tile = {id:'tile',sourceIdentity:'guest',source:'camera',x:-.25,y:.75,width:1.5,height:.5,fit:'contain',muted:true,borderRadius:30};
const scene = {id:'scene',name:'Main',width:1920,height:1080,revision:4,tiles:[tile]};
const validated = validateMultiviewScene(scene);
assert.deepEqual(validated.tiles[0],tile,'Offcanvas slots and corner radius are stored without distortion');
for (const patch of [{x:-1.001},{y:1.001},{width:0},{width:2.001},{height:-1},{x:NaN},{height:Infinity},{borderRadius:-1},{borderRadius:50.1},{borderRadius:'20'},{borderRadius:NaN}]) {
  assert.throws(()=>validateMultiviewScene({...scene,tiles:[{...tile,...patch}]}),undefined,JSON.stringify(patch));
}
// Widths smaller than the interactive minimum predate the editor and remain valid.
assert.equal(validateMultiviewScene({...scene,tiles:[{...tile,width:.01}]}).tiles[0].width,.01);
for (const radius of [0,50]) assert.equal(validateMultiviewScene({...scene,tiles:[{...tile,borderRadius:radius}]}).tiles[0].borderRadius,radius);
for (const value of [
  {...scene,token:'secret'},
  {...scene,tiles:[{...tile,password:'secret'}]},
  {...scene,tiles:[{...tile,transform:{zoom:1,token:'secret'}}]},
  {...scene,absence:{mode:'black',url:'https://example.test'}},
  {...scene,absence:{mode:'black',transform:{zoom:1,secret:'secret'}}},
]) assert.throws(()=>validateMultiviewScene(value),'Unknown fields must not be silently accepted');
assert.throws(()=>validateMultiviewScene({...scene,absence:{mode:['black']}}),'Absence mode must be a string enum');
console.log('PASS: offcanvas scene schema, finite radius bounds, strict allowed fields');
