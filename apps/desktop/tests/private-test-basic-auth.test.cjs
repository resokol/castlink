'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{EventEmitter}=require('node:events');
const {readPrivateTestAuth,installPrivateTestAuth}=require('../src/private-test-basic-auth.cjs');
const origin='https://relay.castlink.ru:9443';
function setup(config={origin,username:'studio2',password:'fixture-private-password'},enabled=true){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-test-auth-')),file=path.join(dir,'auth.json');
  fs.writeFileSync(file,typeof config==='string'?config:JSON.stringify(config));
  const app=new EventEmitter(),wc={isDestroyed:()=>false},owner={webContents:wc,isDestroyed:()=>false};
  let current=owner,selected=origin;
  const dispose=installPrivateTestAuth({app,enabled,file,getClient:()=>current,getOrigin:()=>selected});
  const challenge=(patch={})=>{
    const response={prevented:false,args:null};
    app.emit('login',{preventDefault(){response.prevented=true;}},patch.wc||wc,{url:patch.url||origin+'/Studio2'},
      {isProxy:false,scheme:'basic',host:'relay.castlink.ru',port:9443,...patch.auth},(...args)=>response.args=args);
    return response;
  };
  return{app,wc,file,challenge,changeOwner:value=>current=value,changeOrigin:value=>selected=value,
    cleanup(){dispose();fs.rmSync(dir,{recursive:true,force:true});}};
}
test('private test answers exact protected origin for current main window once, then cancels retries',()=>{
 const s=setup();try{
  assert.deepEqual(s.challenge(),{prevented:true,args:['studio2','fixture-private-password']});
  assert.deepEqual(s.challenge(),{prevented:true,args:[]});
 }finally{s.cleanup();}
});
test('foreign origin, port, proxy, auth scheme, window and selected server never receive credentials',()=>{
 for(const patch of [{url:'https://foreign.example/Studio2'},{url:'https://relay.castlink.ru/Studio2'},
   {url:'http://relay.castlink.ru:9443/Studio2'},{auth:{isProxy:true}},{auth:{isProxy:undefined}},
   {auth:{scheme:'digest'}},{auth:{host:'foreign.example'}},{auth:{port:443}},{wc:{isDestroyed:()=>false}}]){
  const s=setup();try{assert.deepEqual(s.challenge(patch),{prevented:true,args:[]});assert.equal(s.challenge().args.length,2);}finally{s.cleanup();}
 }
 const s=setup();try{s.changeOrigin('https://castlink.ru');assert.deepEqual(s.challenge().args,[]);s.changeOrigin(origin);
 s.changeOwner(undefined);assert.deepEqual(s.challenge().args,[]);}finally{s.cleanup();}
});
test('ordinary build installs no listener and does not read private file',()=>{
 const s=setup(undefined,false);try{assert.equal(s.app.listenerCount('login'),0);assert.deepEqual(s.challenge(),{prevented:false,args:null});}finally{s.cleanup();}
});
test('sidecar is bounded, exact HTTPS origin only and has no control characters or extra fields',()=>{
 for(const config of [
  '{',{}, {origin:origin+'/',username:'u',password:'p'},
  {origin:'http://relay.castlink.ru:9443',username:'u',password:'p'},
  {origin:'https://u:p@relay.castlink.ru:9443',username:'u',password:'p'},
  {origin,username:'u',password:'p',studioPassword:'must-not-load'},
  {origin,username:'u:x',password:'p'},{origin,username:'u',password:'p\n'},
  {origin,username:'u',password:''},' '.repeat(4097)]){
  const s=setup(config);try{assert.equal(readPrivateTestAuth(s.file),null);assert.equal(s.app.listenerCount('login'),0);}finally{s.cleanup();}
 }
 assert.equal(readPrivateTestAuth('relative.json'),null);
 assert.equal(readPrivateTestAuth(path.resolve('does-not-exist.json')),null);
});
test('disposal removes listener and new main window gets its own single attempt',()=>{
 const s=setup();try{s.challenge();const wc={isDestroyed:()=>false};s.changeOwner({webContents:wc,isDestroyed:()=>false});
 assert.equal(s.challenge({wc}).args.length,2);}finally{s.cleanup();}
 assert.equal(s.app.listenerCount('login'),0);
});
