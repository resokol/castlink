const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX};
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:options}).outputText;
const componentFile=__dirname+'/../components/ScreenShareSetup.tsx';
assert.ok(fs.existsSync(componentFile),'dedicated first-use component must exist');
const csp=fs.readFileSync(__dirname+'/../next.config.ts','utf8').match(/frame-src ([^;]+);/)[1];assert.equal(csp,"'self' castlink: castlink-presenter: castlink-remote: castlink-share:",'CSP must allow the dedicated component iframe without relaxing other schemes');
const jsx=(type,props)=>({type,props}),exportsUi={};
vm.runInNewContext(compile(componentFile),{exports:exportsUi,require:()=>({jsx,jsxs:jsx})});
const walk=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(walk):[n,...walk(n.props?.children)];
for(const locale of ['ru','en','zh-CN']){
 let retry=0,cancel=0;const tree=walk(exportsUi.ScreenShareSetup({locale,busy:false,onRetry:()=>retry++,onCancel:()=>cancel++}));
 const link=tree.find(n=>n.type==='a');assert.equal(link.props.href,'https://castlink.ru/general/screen-share-component/CastLink-Screen-Share-Setup.exe');assert.ok(Object.hasOwn(link.props,'download'),'download is explicit click, never navigation to installer');
 const buttons=tree.filter(n=>n.type==='button');assert.equal(buttons.length,2);buttons[0].props.onClick();buttons[1].props.onClick();assert.equal(retry,1);assert.equal(cancel,1);
 const disabled=walk(exportsUi.ScreenShareSetup({locale,busy:true,onRetry(){},onCancel(){}}));assert.ok(disabled.filter(n=>n.type==='button').every(n=>n.props.disabled));
}
(async()=>{
 const {EventEmitter}=require('node:events'),room=new EventEmitter(),client={},requests=[],launches=[];let complete,current=true;
 room.state='connected';room.localParticipant={identity:'guest-owner',sid:'owner'};
 const session={id:'pending',generation:'gen',revision:0,phase:'pairing'};
 vm.runInNewContext(compile(__dirname+'/../lib/remote-pc-client.ts'),{exports:client,require:()=>({REMOTE_PC_ENDPOINT:'/api/remote-pc-control',REMOTE_PC_PURPOSE:'remote-pc-v1',RoomEvent:{Disconnected:'disconnected',Reconnecting:'reconnecting'}}),URL,WeakMap,Map,Set,Promise,Date,AbortController,setTimeout,clearTimeout,fetch:async(_url,options)=>{
  const body=JSON.parse(options.body);requests.push(body);
  if(body.action==='begin')return new Promise(resolve=>{complete=()=>resolve({ok:true,json:async()=>({ticket:'rp1_'+'a'.repeat(43),ticketExpiresAt:Date.now()+120000,session})});});
  return {ok:true,json:async()=>({sessions:[],sources:[]})};
 }});
 const disconnect=client.connectRemotePc(room,{token:'test-only',studioId:'studio',room:'room'});
 const host={location:{origin:'https://castlink.example'},document:{body:{appendChild:f=>launches.push(f.src)},createElement:()=>({setAttribute(){},remove(){}})},setTimeout:()=>1};
 const begin=client.beginRemotePc(room,host,()=>current);current=false;complete();await assert.rejects(begin,/ended|cancelled/i);assert.equal(launches.length,0,'retired begin cannot open a local process');assert.ok(requests.some(r=>r.action==='stop'&&r.sessionId==='pending'&&r.generation==='gen'),'only exact abandoned begin is cancelled');
 current=true;const again=client.beginRemotePc(room,host,()=>current);complete();await again;assert.equal(launches.length,1);assert.equal(new URL(launches[0]).protocol,'castlink-share:');assert.equal(requests.filter(r=>r.action==='begin').length,2,'retry obtains fresh begin rather than consumed ticket');disconnect();
 console.log('PASS explicit localized first-use setup and fresh retry; retired async launch suppressed');
})().catch(e=>{console.error(e);process.exitCode=1});
