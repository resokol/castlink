const assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs');
const {listenForCoPresentationMenu,requestCoPresentationMenu}=load('../lib/co-presentation-menu.ts');
const host=new EventTarget(),room={},other={};let opens=0,available=true;
const close=listenForCoPresentationMenu(room,()=>{if(!available)return false;opens++;return true;},host);
assert.equal(requestCoPresentationMenu(other,host),false,'another room cannot open the owner menu');
assert.equal(requestCoPresentationMenu(room,host),true);assert.equal(opens,1,'exact mounted room opens once');
available=false;assert.equal(requestCoPresentationMenu(room,host),false,'missing current owner keeps screen controls fallback');assert.equal(opens,1);
close();available=true;assert.equal(requestCoPresentationMenu(room,host),false,'unmounted owner cannot reopen an old menu');assert.equal(opens,1);
console.log('PASS local presentation-menu request: exact room object, current owner acceptance and cleanup');
