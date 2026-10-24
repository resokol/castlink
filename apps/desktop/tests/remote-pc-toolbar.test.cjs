'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
class Element{constructor(){this.children=[];this.listeners={};this.hidden=false;this.disabled=false;this.textContent='';}append(...v){this.children.push(...v);}replaceChildren(...v){this.children=v;}addEventListener(n,f){this.listeners[n]=f;}click(){this.listeners.click?.();}setAttribute(n,v){this[n]=v;}}
function fixture(){const elements=new Map(),sent=[];let change;const document={documentElement:{},querySelector:n=>{if(!elements.has(n))elements.set(n,new Element());return elements.get(n);},createElement:()=>new Element()};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../ui/stop-panel.js'),'utf8'),{document,window:{castlinkStop:{onState:f=>change=f,stop:()=>sent.push('stop'),ready(){},intent:v=>sent.push(v)}},setInterval:()=>{},Date});return {elements,sent,change:v=>change(v)};}
const captureId='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const toolbar={captureId,sessionId:'s',generation:'g',revision:1,sequence:1,expiresAt:Date.now()+30000,locale:'en',status:'ready',busy:false,participants:[{identity:'guest',sid:'PA_c',name:'<img onerror=bad>'}],requests:[{id:'req',requester:{identity:'guest',sid:'PA_c',name:'Guest'},expiresAt:Date.now()+30000}]};
const state={captureId,locale:'en',stopping:false,failed:false,shortcutAvailable:true,labels:{stop:'Stop screen',stopping:'Stopping',stopError:'Retry'},remoteControl:toolbar};
test('native toolbar renders real participant text and exact approval/delegate intents',()=>{
 const f=fixture();f.change(state);assert.equal(f.elements.get('#remote-control').hidden,false);
 const menu=f.elements.get('#participants');assert.equal(menu.children[0].textContent,'<img onerror=bad>');menu.children[0].click();assert.equal(f.sent[0].action,'delegate');assert.equal(f.sent[0].participant.sid,'PA_c');assert.equal(f.sent[0].sequence,1);
 const request=f.elements.get('#requests').children[0];request.children[1].click();assert.equal(f.sent[1].action,'decide-request');assert.equal(f.sent[1].decision,'approve');assert.equal(f.sent[1].requestId,'req');
 f.elements.get('#stop').click();assert.equal(f.sent.at(-1),'stop');
});
test('stale native buttons cannot act on replaced snapshot and busy blocks all control intents',()=>{
 const f=fixture();f.change(state);const old=f.elements.get('#participants').children[0];f.change({...state,remoteControl:{...toolbar,sequence:2,busy:true}});old.click();assert.equal(f.sent.length,0);f.elements.get('#participants').children[0].click();assert.equal(f.sent.length,0);
 f.change({...state,remoteControl:undefined});assert.equal(f.elements.get('#remote-control').hidden,true);
});
test('same-scope polling keeps participant keyboard focus and emits current sequence',()=>{
 const f=fixture();f.change(state);const focused=f.elements.get('#participants').children[0];f.change({...state,remoteControl:{...toolbar,sequence:2}});assert.equal(f.elements.get('#participants').children[0],focused);focused.click();assert.equal(f.sent[0].sequence,2);
});
test('native control labels and full-PC disclosure cover RU EN and zh-CN',()=>{
 for(const [locale,give,scope]of [['ru','Передать управление','Клавиатура и мышь всего ПК'],['en','Give control','Keyboard and pointer for the full PC'],['zh-CN','交出控制权','整台电脑的键盘和鼠标']]){const f=fixture();f.change({...state,locale,remoteControl:{...toolbar,locale}});assert.equal(f.elements.get('#give').textContent,give);assert.equal(f.elements.get('#disclosure').textContent,scope);}
});
