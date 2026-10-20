'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
async function fixture(locale='ru',audioAvailable=true){
 const ids=new Map(),chosen=[],listeners={};
 class Element{constructor(){this.hidden=false;this.checked=false;this.children=[];this.events={};}append(...items){this.children.push(...items);}addEventListener(name,fn){this.events[name]=fn;}}
 for(const id of ['title','note','cancel','audio-settings','audio-option','audio-help','audio-label','include-audio','status','sources'])ids.set(id,new Element());
 const document={documentElement:{dataset:{}},querySelector:id=>ids.get(id.slice(1)),createElement:()=>new Element(),addEventListener(){}};
 const media={matches:false,addEventListener:(name,fn)=>listeners[name]=fn};
 const window={matchMedia:()=>media,castlinkPicker:{sources:async()=>({locale,audioAvailable,sources:[{id:'window:12:0',name:'Deck.pptx',thumbnail:'data:image/png;base64,AA=='}]}),choose:async value=>chosen.push(value)}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../ui/capture-picker.js'),'utf8'),{document,window});
 await new Promise(resolve=>setImmediate(resolve));
 return{document,chosen,get:id=>ids.get(id),switchTheme:light=>{media.matches=light;listeners.change?.();}};
}
test('picker follows native theme changes while localized audio copy keeps actual capture limits',async()=>{
 for(const [locale,label] of [['ru','Передавать звук'],['en','Share audio'],['zh-CN','共享音频']]){
  const f=await fixture(locale);assert.equal(f.document.documentElement.dataset.theme,'dark');f.switchTheme(true);assert.equal(f.document.documentElement.dataset.theme,'light');f.switchTheme(false);assert.equal(f.document.documentElement.dataset.theme,'dark');
  assert.equal(f.get('audio-label').textContent,label);assert.match(f.get('audio-help').textContent,/PowerPoint/);assert.equal(f.get('audio-settings').hidden,false);
  f.get('include-audio').checked=true;await f.get('sources').children[0].events.click();assert.equal(f.chosen[0].audio,true);assert.equal(f.chosen[0].id,'window:12:0');
 }
});
test('unavailable audio stays hidden and cannot be requested through picker selections',async()=>{
 const f=await fixture('ru',false);assert.equal(f.get('audio-settings').hidden,true);f.get('include-audio').checked=true;await f.get('sources').children[0].events.click();assert.equal(f.chosen[0].audio,false);
});
