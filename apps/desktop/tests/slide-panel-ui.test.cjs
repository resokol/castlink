'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture(){
 let paint;const sent=[],menus=[],hidden=[];
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attributes={};this.events=new Map();this.hidden=false;this.disabled=false;this.textContent='';this.classes=new Set();this.classList={toggle:(key,value)=>{value?this.classes.add(key):this.classes.delete(key);}};}
  setAttribute(key,value){this.attributes[key]=value;}addEventListener(key,fn){this.events.set(key,fn);}append(...nodes){nodes.forEach(node=>this.insertBefore(node,null));}insertBefore(node,next){node.remove();node.parent=this;const index=next?this.children.indexOf(next):-1;this.children.splice(index<0?this.children.length:index,0,node);}remove(){if(this.parent){this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=undefined;}}contains(node){return node===this||this.children.some(child=>child.contains(node));}querySelectorAll(tag){return this.children.flatMap(child=>[...(child.tagName===tag.toUpperCase()?[child]:[]),...child.querySelectorAll(tag)]);}focus(){document.activeElement=this;}click(){if(this.disabled||this.hidden)return;this.events.get('click')?.({target:this});document.events.get('click')?.({target:this});}
 }
 const ids=new Map(),html=fs.readFileSync(path.join(__dirname,'../ui/slide-panel.html'),'utf8');for(const[,id]of html.matchAll(/id="([^"]+)"/g))ids.set(id,new Element(['previous','next','reclaim','stop','hide','control-toggle'].includes(id)?'button':'div'));
 const document={documentElement:{},activeElement:undefined,events:new Map(),getElementById:id=>ids.get(id),createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),addEventListener(key,fn){this.events.set(key,fn);}};
 ids.get('menu-host').append(ids.get('control-menu'));ids.get('control-menu').append(ids.get('participants'),ids.get('reclaim'));
 const bridge={onState:fn=>paint=fn,ready(){},action:value=>sent.push(JSON.parse(JSON.stringify(value))),menu:value=>menus.push(value),hide:()=>hidden.push(true)};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../ui/slide-panel.js'),'utf8'),{document,window:{castlinkSlides:bridge},Set,Map});
 return{paint:state=>paint(state),get:id=>ids.get(id),sent,menus,hidden,document,key:(key,target=document.activeElement)=>{const event={key,target,preventDefault(){}};document.events.get('keydown')(event);}};
}
const legacy=()=>({id:'session:grant:1',title:'Report <b>raw</b>.pptx',controller:'Управляет: Анна',page:3,pages:18,canNavigate:true,canReclaim:false,busy:false,locale:'ru'});
const v2=()=>({...legacy(),toolbar:{canDelegate:true,canStop:true,sharing:true,controllerIdentity:'guest-one',participants:[{identity:'guest-one',name:'Анна'},{identity:'guest-two',name:'李明'}]}});
test('legacy native panel displays neutral unconfirmed sharing and no invented STOP',()=>{
 const f=fixture();f.paint(legacy());assert.match(f.get('status').textContent,/не подтверждён/);assert.equal(f.get('sharing-strip').classes.has('active'),false);assert.equal(f.get('stop').hidden,true);assert.equal(f.get('control-toggle').hidden,true);assert.equal(f.get('title').textContent,legacy().title);
});
test('STOP is independent of pending slide, duplicate-protected, and explicitly retryable after failed acknowledgement',()=>{
 const f=fixture();f.paint({...v2(),busy:true});assert.equal(f.get('previous').disabled,true);assert.equal(f.get('stop').disabled,false);f.get('stop').click();f.get('stop').click();assert.deepEqual(f.sent,[{id:legacy().id,action:'stop'}]);assert.match(f.get('stop-label').textContent,/Останавливаем/);
 f.paint({...v2(),busy:true,stopPending:false,stopFailed:true});assert.equal(f.get('stop-error').hidden,false);assert.match(f.get('stop-error').textContent,/Не удалось.*Повторите/);assert.equal(f.get('stop').disabled,false);f.get('stop').click();assert.equal(f.sent.length,2);
});
test('participant menu preserves focus through polling, supports keyboard and hide sends no API action',()=>{
 const f=fixture();f.paint(v2());f.get('control-toggle').click();const first=f.get('participants').children[0];assert.equal(f.document.activeElement,first);f.paint({...v2(),page:4});assert.equal(f.document.activeElement,first);assert.equal(f.get('participants').children[0],first);assert.equal(first.attributes['aria-checked'],'true');
 f.key('ArrowDown');assert.equal(f.document.activeElement,f.get('participants').children[1]);f.get('control-menu').scrollTop=90;f.key('Escape');assert.equal(f.get('menu-host').hidden,true);assert.equal(f.document.activeElement,f.get('control-toggle'));
 f.get('control-toggle').click();assert.equal(f.get('control-menu').scrollTop,0,'reopening starts at menu heading');
 f.get('hide').click();assert.equal(f.hidden.length,1);assert.equal(f.sent.length,0);assert.equal(f.menus.at(-1),false);
});
test('retired participant DOM action cannot delegate a replacement session to the same identity',()=>{
 const f=fixture();f.paint(v2());f.get('control-toggle').click();const old=f.get('participants').children[1];f.paint({...v2(),id:'replacement:grant:2'});old.click();assert.equal(f.sent.length,0);
 f.get('control-toggle').click();f.get('participants').children[1].click();assert.deepEqual(f.sent,[{id:'replacement:grant:2',action:'delegate',controllerIdentity:'guest-two'}]);
});

test('recipient exposes only navigation while owner STOP survives delegation errors in every locale',()=>{
 const f=fixture();
 for(const locale of ['ru','en','zh-CN']){
  f.paint({...legacy(),locale});assert.equal(f.get('heading').hidden,true);assert.equal(f.get('control-wrap').hidden,true);assert.equal(f.get('controller').hidden,true);assert.equal(f.get('stop').hidden,true);assert.equal(f.get('reclaim').hidden,true);
  f.paint({...v2(),locale,busy:true,toolbar:{...v2().toolbar,canDelegate:false}});
  assert.equal(f.get('heading').hidden,false);assert.equal(f.get('controller').hidden,false);assert.equal(f.get('stop').hidden,false);assert.equal(f.get('stop').disabled,false);assert.equal(f.get('control-toggle').hidden,true);
 }
});

test('recipient status announces pending navigation with hidden owner controller details',()=>{
 const f=fixture();f.paint({...legacy(),busy:true});assert.equal(f.get('controller').hidden,true);assert.match(f.get('status').textContent,/Ожидаем подтверждения/);assert.equal(f.get('previous').disabled,true);assert.equal(f.get('next').disabled,true);
});

test('owner keeps slide navigation after delegating in all locales',()=>{
 const f=fixture();
 for(const locale of ['ru','en','zh-CN']){
  f.paint({...v2(),locale});assert.equal(f.get('next').disabled,false);f.get('next').click();
  assert.equal(f.sent.at(-1).action,'next');
 }
});
