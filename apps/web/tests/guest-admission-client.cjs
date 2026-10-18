const assert=require('node:assert/strict');const{load}=require('./load-typescript.cjs');
(async()=>{const {waitForGuestAdmission}=load('../lib/guest-admission-client.ts');const saved=new Map(),storage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};let starts=0,polls=0,waiting=0;
 const fetcher=async(url,options)=>{if(options.method==='POST'){starts++;assert.equal(JSON.parse(options.body).invite,'personal');return{ok:true,json:async()=>({id:'session',state:'waiting',capability:'cap'})};}polls++;assert.equal(options.headers['x-castlink-guest-admission'],'cap');return{ok:true,json:async()=>({state:'admitted'})};};
 const capability=await waitForGuestAdmission({studioId:'studio-default',room:'A',name:'Alice',storage,fetcher,personalInvite:'personal',onWaiting:()=>waiting++,pollMs:1});assert.equal(capability,'cap');assert.equal(starts,1);assert.equal(polls,1);assert.equal(waiting,1);
 const abort=new AbortController();abort.abort();await assert.rejects(waitForGuestAdmission({studioId:'studio-default',room:'A',name:'Alice',storage,fetcher,signal:abort.signal}),e=>e.name==='AbortError');
 console.log('PASS admission client: capability retained, personal invite, waiting before admission, abort');
})().catch(e=>{console.error(e);process.exitCode=1;});
