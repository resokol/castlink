'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {showRemotePcControls}=require('../src/remote-pc-helper.cjs');
function fixture(bounds={x:1900,y:950,width:620,height:270}){
 const events=[];return {events,window:{isDestroyed:()=>false,getBounds:()=>bounds,setMinimumSize:(...args)=>events.push(['minimum',...args]),setBounds:value=>events.push(['bounds',value]),setContentProtection:value=>events.push(['protect',value]),setAlwaysOnTop:(...args)=>events.push(['top',...args]),showInactive:()=>events.push(['showInactive']),minimize:()=>assert.fail('published controls must remain available above the presentation'),focus:()=>assert.fail('showing controls must not steal PowerPoint focus')}};
}
test('published controls fit selected display and stay above applications without stealing focus',()=>{
 const f=fixture();showRemotePcControls(f.window,{getDisplayMatching:()=>({workArea:{x:0,y:0,width:1920,height:1080}})});
 assert.deepEqual(f.events.find(e=>e[0]==='bounds')[1],{x:1500,y:740,width:420,height:340});
 assert.deepEqual(f.events.find(e=>e[0]==='top'),['top',true,'screen-saver']);assert.deepEqual(f.events.find(e=>e[0]==='protect'),['protect',true]);assert.equal(f.events.at(-1)[0],'showInactive');
});
test('small work area clamps panel dimensions and its minimum without moving to another monitor',()=>{
 const f=fixture({x:-10,y:-10,width:620,height:270});showRemotePcControls(f.window,{getDisplayMatching:()=>({workArea:{x:-300,y:0,width:300,height:200}})});
 assert.deepEqual(f.events.find(e=>e[0]==='bounds')[1],{x:-300,y:0,width:300,height:200});assert.deepEqual(f.events.find(e=>e[0]==='minimum'),['minimum',300,200]);
});
test('retired publisher window cannot be revived by a late publication',()=>{
 let calls=0;showRemotePcControls({isDestroyed:()=>true},{getDisplayMatching:()=>{calls++;}});assert.equal(calls,0);
});
