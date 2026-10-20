const assert=require('node:assert/strict');
const {load}=require('./load-typescript.cjs');
const {createFloatingPanelDrag}=load('../lib/floating-panel-position.ts');
class Target extends EventTarget { constructor(){super();this.style={};} setPointerCapture(id){this.captured=id;} releasePointerCapture(){this.captured=undefined;} }
const win=new Target();win.innerWidth=800;win.innerHeight=600;win.visualViewport=new Target();Object.assign(win.visualViewport,{width:800,height:600,offsetLeft:0,offsetTop:0});
const panel=new Target(),handle=new Target();panel.ownerDocument={defaultView:win};let rect={left:100,top:100,width:300,height:180};panel.getBoundingClientRect=()=>({...rect,left:parseFloat(panel.style.left)||rect.left,top:parseFloat(panel.style.top)||rect.top});
const fire=(type,data)=>{const e=new Event(type,{cancelable:true});Object.assign(e,data);handle.dispatchEvent(e);return e;};
const drag=createFloatingPanelDrag(panel,handle);
assert.equal(drag.clamp(),false,'anchoring remains active before first drag');
const ignored=new Event('pointerdown',{cancelable:true});Object.assign(ignored,{button:0,pointerId:7,clientX:20,clientY:20});Object.defineProperty(ignored,'target',{value:{closest:()=>({})}});handle.dispatchEvent(ignored);assert.equal(handle.captured,undefined,'buttons/selects/links never start header drag');
fire('pointerdown',{button:0,pointerId:1,clientX:120,clientY:110});fire('pointermove',{pointerId:1,clientX:1200,clientY:1000});
assert.equal(panel.style.left,'488px');assert.equal(panel.style.top,'408px');assert.equal(handle.captured,1);
fire('pointercancel',{pointerId:1});assert.equal(handle.captured,undefined);fire('pointermove',{pointerId:1,clientX:-100,clientY:-100});assert.equal(panel.style.left,'488px','cancel ends drag');
win.innerWidth=400;win.visualViewport.width=400;win.innerHeight=300;win.visualViewport.height=300;win.dispatchEvent(new Event('resize'));assert.equal(panel.style.left,'88px');assert.equal(panel.style.top,'108px');assert.equal(panel.style.maxWidth,'376px');assert.equal(panel.style.maxHeight,'276px');
fire('keydown',{key:'ArrowLeft',shiftKey:false});assert.equal(panel.style.left,'80px');
drag.dispose();fire('keydown',{key:'ArrowLeft'});assert.equal(panel.style.left,'80px','disposed handle is inert');
console.log('PASS floating header pointer/cancel/keyboard/viewport bounds');
