'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createCaptureGate,bindSelectedSource}=require('../src/remote-pc-capture.cjs');
const source={id:'window:144:78',name:'Own fixture'};
test('one native picker permits exactly one matching trusted publisher capture decision',async()=>{
 let handler;const session={setDisplayMediaRequestHandler:fn=>handler=fn};const frame={url:'https://studio.example/remote-pc/publisher'},window={isDestroyed:()=>false,webContents:{mainFrame:frame}};
 const gate=createCaptureGate({session,window,pageUrl:frame.url});gate.select(source);
 let answer;handler({frame,videoRequested:true,userGesture:false},v=>answer=v);assert.equal(answer.video,source);
 handler({frame,videoRequested:true,userGesture:false},v=>answer=v);assert.deepEqual(answer,{});
 gate.select(source);handler({frame:{...frame},videoRequested:true,userGesture:true},v=>answer=v);assert.deepEqual(answer,{});
 gate.dispose();assert.equal(handler,null);
});
test('native source binding parses real HWND only; monitor uses physical exact conversion',()=>{
 assert.deepEqual(bindSelectedSource(source),{kind:'window',hwnd:'144'});
 const screen={getAllDisplays:()=>[{id:8,bounds:{x:-100,y:0,width:100,height:100}}],dipToScreenRect:(w,r)=>({x:-150,y:0,width:150,height:150})};
 assert.deepEqual(bindSelectedSource({id:'screen:1:0',display_id:'8'},screen),{kind:'screen',rect:{x:-150,y:0,width:150,height:150}});
 assert.throws(()=>bindSelectedSource({id:'screen:1:0',display_id:'7'},screen));
 assert.throws(()=>bindSelectedSource({id:'window:0:0'}));
});
