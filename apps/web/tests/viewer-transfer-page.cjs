require('./i18n-fixture.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
Module._extensions['.ts']=Module._extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,f);
const originalLoad=Module._load,values=new Map(),effects=[],destinations=[],history=[],calls=[];
global.sessionStorage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k),removeItem:k=>values.delete(k)};
const {readTransferSnapshot}=require('../lib/client-transfer.ts');
Module._load=function(id,...args){
 if(id==='react')return {useRef:initial=>({current:initial}),useState:initial=>[initial,()=>{}],useEffect:callback=>effects.push(callback)};
 if(id==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
 if(id==='@/lib/client-transfer')return originalLoad.call(this,require('node:path').join(__dirname,'../lib/client-transfer.ts'),...args);
 return originalLoad.call(this,id,...args);
};
const malicious={role:'studio-viewer',room:'room',studioId:'studio-default',clientId:'elevated',settings:{sound:false,videoEnabled:false,password:'evil'}};
global.window={location:{pathname:'/transfer',search:'',hash:'#handoff=one-time-ticket&state='+encodeURIComponent(JSON.stringify(malicious)),replace:path=>destinations.push(path)},history:{replaceState:(...args)=>history.push(args)}};
global.fetch=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({role:'studio-viewer',room:'room',studioId:'studio-default',identity:'stream-viewer-550e8400-e29b-41d4-a716-446655440000',viewerInvite:'target-signed-invitation'}),{status:200});};
(async()=>{
 require('../app/transfer/page.tsx').default();const cleanup=effects[0]();
 for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(history[0],[null,'','/transfer'],'one-time ticket removed before accepting');
 assert.deepEqual(JSON.parse(calls[0].options.body),{action:'accept',ticket:'one-time-ticket'},'fragment role/settings never grant server authority');
 assert.equal(values.get('castlink-stream-viewer:studio-default:room'),'target-signed-invitation');
 assert.deepEqual(readTransferSnapshot().settings,{sound:false,videoEnabled:false});
 assert.equal(readTransferSnapshot().clientId,undefined);
 assert.deepEqual(destinations,['/watch?studioId=studio-default&room=room']);
 assert.equal(values.has('studiolink-studio-control-client-id:studio-default'),false);
 cleanup();console.log('PASS: actual transfer page stores verified viewer invite, returns /watch and preserves only playback preferences');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{Module._load=originalLoad;});
