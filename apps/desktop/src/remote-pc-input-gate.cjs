'use strict';
const {createHmac,timingSafeEqual}=require('node:crypto');
const RELIABLE='castlink.remote-pc.input.v1',MOVE='castlink.remote-pc.move.v1';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const keyCode=s=>typeof s==='string'&&/^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-9]|2[0-4])|Numpad[0-9]|Numpad(Add|Subtract|Multiply|Divide|Decimal|Enter)|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Meta(Left|Right)|Arrow(Left|Right|Up|Down)|Enter|Tab|Space|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Escape|CapsLock|NumLock|ScrollLock|Pause|PrintScreen|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|IntlBackslash)$/.test(s);
const id=v=>typeof v==='string'&&v.length>=1&&v.length<=256&&!/[\u0000-\u001f\u007f]/.test(v);
function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
function validEvent(e){
 const point=()=>int(e.x,0,65535)&&int(e.y,0,65535);
 switch(e?.type){
 case 'move':return exact(e,['type','x','y'])&&point();
 case 'button':return exact(e,['type','button','down','x','y'])&&int(e.button,0,2)&&typeof e.down==='boolean'&&point();
 case 'wheel':return exact(e,['type','x','y','deltaX','deltaY'])&&point()&&int(e.deltaX,-12000,12000)&&int(e.deltaY,-12000,12000);
 case 'key':return exact(e,['type','code','down','repeat'])&&keyCode(e.code)&&typeof e.down==='boolean'&&typeof e.repeat==='boolean';
 case 'text':return exact(e,['type','text'])&&typeof e.text==='string'&&e.text.length>=1&&e.text.length<=256&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(e.text);
 case 'heartbeat':return exact(e,['type','pressedKeys','pressedButtons'])&&Array.isArray(e.pressedKeys)&&e.pressedKeys.length<=32&&e.pressedKeys.every(keyCode)&&new Set(e.pressedKeys).size===e.pressedKeys.length&&Array.isArray(e.pressedButtons)&&e.pressedButtons.length<=3&&e.pressedButtons.every(b=>int(b,0,2))&&new Set(e.pressedButtons).size===e.pressedButtons.length;
 case 'releaseAll':return exact(e,['type']);default:return false;
 }
}
function createInputGate({input,releaseAll=()=>{},now=()=>performance.now(),wall=()=>Date.now()}){
 let authority,grantTag,seq={move:0,reliable:0},barrier=0,desynced=true,resetSerial=0,queue=Promise.resolve(),pending=0,epoch=0;
 return {
  authorize(value){
   if(!value||value.deadline<=now()||!/^[A-Za-z0-9_-]{43}$/.test(value.inputKey))throw Error('Invalid input authority');
   const tag=value.grantId+':'+value.revision;if(grantTag!==tag){epoch++;grantTag=tag;seq={move:0,reliable:0};barrier=0;desynced=true;resetSerial=0;}
   authority={...value};
  },
  settled:()=>queue,
  close(){epoch++;resetSerial=authority?.leaseSerial||resetSerial;authority=undefined;desynced=true;},
  receive({senderSid,topic,bytes}){
   const a=authority;if(!a||now()>=a.deadline||senderSid!==a.controller.sid||!(topic===RELIABLE||topic===MOVE))return false;
   let f;try{if(!bytes||bytes.length>8192)return false;f=JSON.parse(Buffer.from(bytes).toString('utf8'));}catch{return false;}
   if(!exact(f,['v','sessionId','generation','captureId','grantId','revision','geometryRevision','lane','seq','expiresAt','moveBarrier','event','mac'])||f.v!==1||!['sessionId','generation','captureId','grantId'].every(k=>id(f[k])&&f[k]===a[k])||f.revision!==a.revision||f.geometryRevision!==a.geometryRevision||!int(f.seq,1,Number.MAX_SAFE_INTEGER)||!int(f.moveBarrier,0,Number.MAX_SAFE_INTEGER)||!int(f.expiresAt,1,Number.MAX_SAFE_INTEGER)||!validEvent(f.event)||typeof f.mac!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(f.mac))return false;
   if((f.lane==='move'?(topic!==MOVE||f.event.type!=='move'):(f.lane!=='reliable'||topic!==RELIABLE||f.event.type==='move'))||f.seq<=seq[f.lane]||f.lane==='move'&&f.seq<=barrier)return false;
   const serverNow=a.serverTime+(now()-a.receivedAt);
   const {mac,...unsigned}=f,expected=createHmac('sha256',Buffer.from(a.inputKey,'base64url')).update(canonical(unsigned)).digest();
   const supplied=Buffer.from(mac,'base64url');if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return false;
   const emptyHeartbeat=f.event.type==='heartbeat'&&f.event.pressedKeys.length===0&&f.event.pressedButtons.length===0;
   if(f.event.type==='releaseAll'){epoch++;seq.reliable=f.seq;desynced=true;resetSerial=a.leaseSerial;releaseAll();return true;}
   if(f.expiresAt<=serverNow||f.expiresAt>serverNow+1000){if(f.lane==='reliable'){epoch++;desynced=true;seq.reliable=f.seq;resetSerial=a.leaseSerial;releaseAll();}return false;}
   if(f.lane==='reliable'&&f.seq!==seq.reliable+1){epoch++;desynced=true;releaseAll();if(!emptyHeartbeat){seq.reliable=f.seq;resetSerial=a.leaseSerial;return false;}}
   if(desynced){if(f.lane!=='reliable')return false;seq.reliable=f.seq;if(!emptyHeartbeat||a.leaseSerial<=resetSerial)return false;desynced=false;}
   seq[f.lane]=f.seq;if(f.lane==='reliable')barrier=Math.max(barrier,f.moveBarrier);
   // Native's deadline is local absolute time anchored to this already issued
   // server lease. A delayed network frame can never buy a fresh 750ms.
   if(pending>=64){epoch++;desynced=true;resetSerial=a.leaseSerial;releaseAll();return false;}
   const tag=grantTag,ticket=epoch;pending++;queue=queue.then(()=>{if(epoch!==ticket||grantTag!==tag||authority!==a&&(!authority||authority.grantId!==a.grantId)||now()>=a.deadline)throw Error('Input authority changed');return input({...unsigned,expiresAt:wall()+Math.floor(Math.min(a.deadline-now(),f.expiresAt-(a.serverTime+now()-a.receivedAt)))});}).catch(()=>{if(ticket!==epoch)return;epoch++;desynced=true;resetSerial=authority?.leaseSerial||resetSerial;releaseAll();}).finally(()=>pending--);return true;
  },
 };
}
module.exports={createInputGate,canonical,validEvent};
