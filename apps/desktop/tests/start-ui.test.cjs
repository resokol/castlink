'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture(settings={}){
  const sent=[],setups=[],updates=[],ids=new Map(),nodes=[];
  class Element{
    constructor(attrs){this.dataset={};this.events={};this.value='';this.hidden=/\bhidden\b/.test(attrs);this.disabled=false;this.textContent='';this.attributes={};for(const[,key,value]of attrs.matchAll(/([\w-]+)="([^"]*)"/g)){if(key==='id')ids.set(value,this);if(key.startsWith('data-'))this.dataset[key.slice(5)]=value;this.attributes[key]=value;}}
    addEventListener(key,fn){this.events[key]=fn;}focus(){this.focused=true;}setAttribute(key,value){this.attributes[key]=value;}click(){if(!this.disabled)return this.events.click?.({preventDefault(){}});}change(){return this.events.change?.({});}
  }
  const html=fs.readFileSync(path.join(__dirname,'../ui/start.html'),'utf8');for(const[,attrs]of html.matchAll(/<[a-z][a-z0-9]*\s([^>]+)>/gi))nodes.push(new Element(attrs));
  assert.ok(ids.has('choose-studio')&&ids.has('choose-caster'),'launcher exposes separate role entry actions');
  const document={documentElement:{dataset:{}},querySelector:selector=>ids.get(selector.slice(1)),querySelectorAll:selector=>nodes.filter(node=>selector==='[data-copy]'?'copy'in node.dataset:selector==='[data-setup]'?'setup'in node.dataset:selector==='[data-role]'?'role'in node.dataset:false)};
  const storage=new Map();const window={castlinkLauncher:{updates:async locale=>updates.push(locale),settings:async()=>({serverOrigin:'https://saved.example',reserveOrigins:['https://reserve.example'],locale:'ru',version:'1.0',...settings}),connect:async value=>sent.push(JSON.parse(JSON.stringify(value))),setup:async value=>setups.push(JSON.parse(JSON.stringify(value)))},matchMedia:()=>({matches:false})};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../ui/start.js'),'utf8'),{window,document,localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)}});
  return {get:id=>ids.get(id),sent,setups,updates,document,submit:()=>ids.get('connect').events.submit({preventDefault(){}}),flush:()=>new Promise(resolve=>setImmediate(resolve))};
}
test('role-first launcher keeps studio origin separate from a full caster invitation',async()=>{
  const f=fixture();await f.flush();assert.equal(f.get('role-view').hidden,false);assert.equal(f.get('connect-view').hidden,true);
  await f.get('choose-studio').click();assert.equal(f.get('server').value,'https://saved.example');assert.equal(f.get('reserve-settings').hidden,false);
  await f.get('back').click();await f.get('choose-caster').click();assert.equal(f.get('server').value,'');assert.equal(f.get('reserve-settings').hidden,true);
  const invite='https://studio.example/?name=Show&mode=guest#invite=secret';f.get('server').value=invite;await f.submit();assert.deepEqual(f.sent,[{role:'caster',input:invite,reserves:['https://reserve.example'],locale:'ru'}]);
  await f.get('back').click();await f.get('choose-studio').click();assert.equal(f.get('server').value,'https://saved.example');
});
test('setup actions remain functional and locale/theme controls work across roles',async()=>{
  const f=fixture();await f.flush();await f.get('open-setup').click();assert.equal(f.get('setup-panel').hidden,false);
  f.get('locale').value='en';f.get('locale').change();await f.get('setup-install').click();assert.deepEqual(f.setups,[{action:'install',locale:'en'}]);
  for(const locale of ['ru','en','zh-CN']){f.get('locale').value=locale;f.get('locale').change();await f.get('choose-caster').click();assert.ok(f.get('form-title').textContent);assert.equal(f.document.documentElement.lang,locale);await f.get('back').click();}
  await f.get('theme').click();assert.equal(f.document.documentElement.dataset.theme,'light');await f.get('theme').click();assert.equal(f.document.documentElement.dataset.theme,'dark');
});

test('manual update check is available before role choice in every launcher language',async()=>{
  const f=fixture();await f.flush();
  for(const locale of ['ru','en','zh-CN']){f.get('locale').value=locale;f.get('locale').change();assert.ok(f.get('check-updates').textContent);await f.get('check-updates').click();assert.equal(f.get('check-updates').disabled,false);}
  assert.deepEqual(f.updates,['ru','en','zh-CN']);assert.equal(f.sent.length,0);assert.equal(f.setups.length,0);
});
