const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const { createDocumentPictureInPictureSlot } = load('../lib/document-picture-in-picture.ts');
class Element { constructor() { this.children=[]; this.style={}; } setAttribute() {} append(...nodes) { for(const n of nodes){n.parent=this;this.children.push(n);} } remove() {if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);} }
class Pip extends EventTarget { constructor(){super();this.closed=false;this.screen={availWidth:1920,availHeight:1080};this.innerWidth=this.outerWidth=420;this.innerHeight=this.outerHeight=56;this.document={body:new Element(),head:new Element(),createElement:()=>new Element()};} resizeTo(width,height){this.innerWidth=this.outerWidth=width;this.innerHeight=this.outerHeight=height;} focus(){} close(){this.closed=true;this.dispatchEvent(new Event('pagehide'));} }
(async()=>{
 let requests=0,resolve;const api={requestWindow(){requests++;return new Promise(r=>resolve=r);}};
 let hidden=0;const slides=createDocumentPictureInPictureSlot(api,'slides',()=>hidden++),stop=createDocumentPictureInPictureSlot(api,'stop',()=>hidden++);
 const geometryWindow=new Pip();geometryWindow.outerWidth=1280;geometryWindow.innerWidth=420;geometryWindow.outerHeight=962;geometryWindow.innerHeight=250;let resizeCalls=0;geometryWindow.resizeTo=function(width,height){resizeCalls++;this.outerWidth=this.innerWidth=width;this.outerHeight=this.innerHeight=height;};
 const geometryApi={requestWindow:()=>Promise.resolve(geometryWindow)},geometrySlides=createDocumentPictureInPictureSlot(geometryApi,'slides',()=>{}),geometryStop=createDocumentPictureInPictureSlot(geometryApi,'stop',()=>{});
 await geometrySlides.open({width:420,height:250});assert.equal(resizeCalls,0,'first request trusts browser API dimensions, never opener-derived outer metrics');
 await geometryStop.open({width:420,height:56});assert.equal(geometryWindow.innerWidth,420,'oversized stale frame delta is rejected');assert.equal(geometryWindow.innerHeight,306);
 geometryStop.close();geometryWindow.outerWidth=-50;geometryWindow.outerHeight=-20;await geometryStop.open({width:420,height:56});assert.equal(geometryWindow.innerWidth,420);assert.equal(geometryWindow.innerHeight,306,'negative frame metrics are ignored');geometrySlides.close();geometryStop.close();
 const a=slides.open({width:860,height:250});assert.equal(requests,1,'request is synchronous in user gesture');const b=stop.open({width:420,height:56});assert.equal(requests,1,'both pending slots share one request');const win=new Pip();resolve(win);
 const [av,bv]=await Promise.all([a,b]);assert.equal(av.window,bv.window);assert.equal(win.document.body.children.length,2);assert.equal(win.innerHeight,306,'combined content has room for slides and STOP');
 slides.close();assert.equal(win.closed,false,'STOP survives slides hide/revoke');assert.equal(win.document.body.children.length,1);
 const again=await slides.open({width:860,height:250});assert.equal(requests,1);stop.close();assert.equal(win.closed,false,'slides survive media STOP completion');
 win.close();assert.equal(hidden,3);assert.equal(slides.current(),undefined);
 const old=slides.open({width:860,height:250});slides.close();const fresh=slides.open({width:860,height:250});const freshWin=new Pip();resolve(freshWin);assert.equal(await old,undefined);assert.equal((await fresh).window,freshWin);assert.equal(freshWin.closed,false,'stale request cleanup preserves replacement slot');
 slides.close();assert.equal(freshWin.closed,true);
 const late=stop.open({width:420,height:56});stop.close();const orphan=new Pip();resolve(orphan);assert.equal(await late,undefined);assert.equal(orphan.closed,true,'all canceled claims close a late window');
 const stopFirst=stop.open({width:420,height:56});const small=new Pip();resolve(small);await stopFirst;const expanded=slides.open({width:860,height:250});assert.equal(small.innerHeight,306,'existing STOP window expands synchronously on slides gesture');await expanded;slides.close();assert.equal(small.closed,false);stop.close();
 let closedRequests=0;const closedWindow=new Pip();closedWindow.closed=true;const goodWindow=new Pip();
 const closedSlot=createDocumentPictureInPictureSlot({requestWindow(){return Promise.resolve(closedRequests++ ? goodWindow : closedWindow);}},'slides',()=>{});
 assert.equal(await closedSlot.open({width:420,height:250}),undefined);assert.ok(await closedSlot.open({width:420,height:250}));closedSlot.close();assert.equal(goodWindow.closed,true,'closed fulfilled window cannot retain an orphan claim');
 let tries=0;const rejecting=createDocumentPictureInPictureSlot({requestWindow(){tries++;return Promise.reject(Error('activation'));}},'slides',()=>{});
 assert.equal(await rejecting.open({width:860,height:250}),undefined);assert.equal(await rejecting.open({width:860,height:250}),undefined);assert.equal(tries,2,'denied request is retryable');
 console.log('PASS shared DocumentPiP gesture/STOP preservation/stale claims/pagehide/retry');
})().catch(e=>{console.error(e);process.exitCode=1;});
