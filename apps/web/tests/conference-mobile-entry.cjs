// Execute the actual entry/persistence effects; no browser/media mock behavior is asserted.
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const file=ts.createSourceFile('ConferenceScene.tsx',fs.readFileSync(`${__dirname}/../components/ConferenceScene.tsx`,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let read,write;
(function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(file)==='useEffect'){const effect=node.arguments[0],source=effect.getText(file);if(source.includes('localStorage.getItem(STORAGE)')&&!source.includes('localStorage.setItem'))read=effect;if(source.includes('localStorage.setItem(STORAGE'))write=effect;}ts.forEachChild(node,visit)})(file);
assert.ok(read&&write,'entry and persistence owners exist');
const run=(node,scope)=>vm.runInNewContext(ts.transpileModule(`(${node.getText(file)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,scope)();
function fixture({phone=true,enabled=true,saved='speaker',blocked=false}={}){
 let mode='speaker',automatic=true,split=.88,ready=false,writes=0,stored=saved?JSON.stringify({mode:saved,automatic:false,split:.66,railVersion:2}):null;
 const mobileEntry={current:false};
 const scope=()=>({STORAGE:'prefs',MOBILE_SCENE:'fixture-mobile-query',mobileDefaultTiles:enabled,mobileEntry,window:{matchMedia:()=>({matches:phone})},mode,automatic,split,ready,
  sceneSplit:v=>Number.isFinite(v)?Math.max(.5,Math.min(.88,v)):.88,
  localStorage:{getItem(){if(blocked)throw Error('blocked');return stored},setItem(_key,value){if(blocked)throw Error('blocked');stored=value;writes++}},
  setMode:v=>mode=v,setAutomatic:v=>automatic=v,setSplit:v=>split=v,setReady:v=>ready=v});
 return {scope,get mode(){return mode},get writes(){return writes},get stored(){return stored?JSON.parse(stored):null},setStored:v=>stored=JSON.stringify(v),choose:v=>mode=v,resize:v=>phone=v};
}
const phone=fixture();run(read,phone.scope());assert.equal(phone.mode,'tiles','phone entry ignores a saved Window choice');
run(write,phone.scope());assert.equal(phone.stored.mode,'speaker','automatic mobile Tiles cannot overwrite desktop Window');
phone.choose('speaker');run(write,phone.scope());assert.equal(phone.stored.mode,'speaker','manual mobile choice remains local to this visit');
phone.resize(false);run(write,phone.scope());assert.equal(phone.stored.mode,'speaker','resize does not migrate entry policy');
phone.setStored({mode:'tiles',automatic:true,split:.7,railVersion:2});run(write,phone.scope());assert.equal(phone.stored.mode,'tiles','another desktop tab latest choice is preserved');
const noStorage=fixture({saved:null});run(read,noStorage.scope());assert.equal(noStorage.mode,'tiles');
const restricted=fixture({blocked:true});assert.doesNotThrow(()=>run(read,restricted.scope()));assert.equal(restricted.mode,'tiles');assert.doesNotThrow(()=>run(write,restricted.scope()));
for(const saved of ['speaker','tiles']){const desktop=fixture({phone:false,saved});run(read,desktop.scope());assert.equal(desktop.mode,saved,'desktop restores its existing mode');desktop.choose(saved==='speaker'?'tiles':'speaker');run(write,desktop.scope());assert.equal(desktop.stored.mode,desktop.mode,'desktop choices still persist');}
const staff=fixture({enabled:false});run(read,staff.scope());assert.equal(staff.mode,'speaker','non-caster scenes preserve existing policy');
const strict=fixture(),initial=strict.scope();for(let probe=0;probe<2;probe++){run(read,initial);run(write,initial)}assert.equal(strict.writes,0,'StrictMode setup cannot overwrite storage before hydration');
console.log('PASS caster phone entry defaults, volatile session choice, latest desktop preference, blocked storage and desktop persistence');
