require('./i18n-fixture.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject};}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture(){
 const hooks=[],effects=[],intervals=new Map(),deadlines=[],polls=[];let cursor=0,tree,onChange=()=>{},timerId=0,startPending,generatePending,room='Room';const submissions=[],downloads=[];
 const react={
  useState(initial){const i=cursor++;if(!hooks[i])hooks[i]={value:typeof initial==='function'?initial():initial};return [hooks[i].value,value=>{hooks[i].value=typeof value==='function'?value(hooks[i].value):value;}];},
  useRef(initial){const i=cursor++;if(!hooks[i])hooks[i]={current:initial};return hooks[i];},
  useEffect(effect,deps){const i=cursor++,old=hooks[i];if(!old||deps.some((value,index)=>value!==old.deps[index])){effects.push(()=>{old?.cleanup?.();hooks[i]={deps,cleanup:effect()};});}}
 };
 const request=(url,options={})=>{
  const input=options.body?JSON.parse(options.body):null;
  if(input?.action==='fingerprint')return Promise.resolve(Response.json({fingerprint:'SHA256:'+'A'.repeat(43)}));
  if(input)submissions.push(input);
  if(input?.action==='generate-key')return generatePending?.promise||Promise.resolve(Response.json({privateKey:'-----BEGIN RSA PRIVATE KEY-----\nfixture-generated-key\n-----END RSA PRIVATE KEY-----',publicKey:'ssh-rsa fixture-public'}));
  if(input?.action==='authorize-key')return Promise.resolve(Response.json({ok:true}));
  if(input?.action==='start'){
   if(startPending){options.signal?.addEventListener('abort',()=>startPending.reject(options.signal.reason),{once:true});return startPending.promise;}
   return Promise.resolve(Response.json({id:'job-1',state:'running',stage:'connecting'}));
  }
  if(url.includes('jobId=')){
   const pending=deferred();polls.push({pending,signal:options.signal});options.signal?.addEventListener('abort',()=>pending.reject(options.signal.reason),{once:true});return pending.promise;
  }
  return Promise.resolve(Response.json({profiles:[]}));
 };
 const compiled=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../components/ServerConnections.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const module={exports:{}};
 vm.runInNewContext(compiled,{module,exports:module.exports,require:name=>name==='react'?react:name==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'fragment'}:require(name),fetch:request,URL:{createObjectURL:()=> 'blob:fixture-key',revokeObjectURL:()=>{}},Blob,document:{createElement:()=>({click(){downloads.push(this.download);}})},URLSearchParams,AbortSignal:{timeout(ms){const controller=new AbortController();deadlines.push({ms,abort:()=>controller.abort(new DOMException('Timed out','TimeoutError'))});return controller.signal;}},setInterval(callback){const id=++timerId;intervals.set(id,callback);return id;},clearInterval(id){intervals.delete(id);},setTimeout,clearTimeout,Date,Error,DOMException,console});
 const render=callback=>{if(callback)onChange=callback;cursor=0;tree=module.exports.ServerConnections({room,studioId:'studio-default',onChange});while(effects.length)effects.shift()();return tree;};
 const nodes=(node=tree,result=[])=>{if(Array.isArray(node)){for(const value of node)if(value!==undefined)nodes(value,result);}else if(node&&typeof node==='object'){result.push(node);if(node.props?.children!==undefined)nodes(node.props.children,result);}return result;};
 const text=node=>Array.isArray(node)?node.map(text).join(''):node&&typeof node==='object'?text(node.props?.children):String(node??'');
 const input=label=>{const target=nodes().find(node=>node.type==='label'&&text(node).startsWith(label));assert.ok(target,'Missing label: '+label);return nodes(target).find(node=>node.type==='input');};
 const button=label=>nodes().find(node=>node.type==='button'&&text(node)===label);
 async function prepare(){render();await flush();render();input('Публичный IPv4').props.onChange({target:{value:'8.8.8.8'}});render();button('Проверить SSH ключ сервера').props.onClick();await flush();render();nodes().find(node=>node.type==='input'&&node.props.type==='checkbox').props.onChange({target:{checked:true}});input('SSH пароль').props.onChange({target:{value:'fixture-password-memory-only'}});render();}
 async function begin(){await prepare();button('Подключить сервер').props.onClick();await flush();render();}
 return {render,begin,prepare,input,button,nodes,submissions,downloads,select(label){return nodes(nodes().find(node=>node.type==='label'&&text(node).startsWith(label))).find(node=>node.type==='select');},setRoom(value){room=value;},setGeneratePending(value){generatePending=value;},polls,deadlines,intervals,text:()=>text(tree),setStartPending(value){startPending=value;},dispose(){for(const hook of hooks)hook?.cleanup?.();}};
}
test('running SSH job keeps its polling lifecycle through studio rerenders and uses the latest completion callback',async()=>{
 const f=fixture();let completed=0;
 try{
  await f.begin();assert.equal(f.polls.length,1);
  for(let i=0;i<5;i++)f.render(()=>{completed=i+1;});
  assert.equal(f.polls.length,1,'parent meter rerenders restarted the pending job poll');
  f.polls[0].pending.resolve(Response.json({id:'job-1',state:'complete',stage:'Сервер подключён'}));await flush();f.render();
  assert.match(f.text(),/Сервер подключён/);assert.equal(completed,5);
 }finally{f.dispose();}
});
test('slow status requests stay single-flight across timer ticks',async()=>{
 const f=fixture();try{await f.begin();for(let i=0;i<5;i++)for(const tick of f.intervals.values())tick();await flush();assert.equal(f.polls.length,1,'slow status requests overlapped');}finally{f.dispose();}
});
test('a stalled start request has a finite deadline and shows that remote operation status is unknown',async()=>{
 const f=fixture();try{
  f.setStartPending(deferred());await f.begin();
  assert.ok(f.deadlines.length,'start request has no deadline');
  for(const deadline of f.deadlines){assert.ok(deadline.ms<=25000);deadline.abort();}await flush();f.render();
  assert.doesNotMatch(f.text(),/Подключаем…/);assert.match(f.text(),/Статус установки на VPS пока неизвестен/);assert.doesNotMatch(f.text(),/fixture-password-memory-only/);
 }finally{f.dispose();}
});

test('private-key selection requires confirmed host trust, submits only the selected auth and clears passphrase',async()=>{
 const f=fixture();try{
  await f.prepare();f.select('Способ SSH входа').props.onChange({target:{value:'private-key'}});f.render();
  await f.input('Файл SSH приватного ключа').props.onChange({target:{files:[{size:100,text:async()=> '-----BEGIN OPENSSH PRIVATE KEY-----\nfixture-private-key\n-----END OPENSSH PRIVATE KEY-----'}]}});await flush();f.render();
  f.input('Пароль ключа').props.onChange({target:{value:'fixture-passphrase'}});f.render();
  const trust=f.nodes().find(node=>node.type==='input'&&node.props.type==='checkbox');trust.props.onChange({target:{checked:false}});f.render();assert.equal(f.button('Подключить сервер').props.disabled,true);
  trust.props.onChange({target:{checked:true}});f.render();assert.equal(f.button('Подключить сервер').props.disabled,false);f.button('Подключить сервер').props.onClick();await flush();f.render();
  const start=f.submissions.find(input=>input.action==='start');assert.equal(start.authType,'private-key');assert.match(start.privateKey,/fixture-private-key/);assert.equal(start.passphrase,'fixture-passphrase');assert.equal(start.password,undefined);
  assert.equal(f.input('Пароль ключа').props.value,'');assert.doesNotMatch(f.text(),/fixture-private-key|fixture-passphrase|fixture-password-memory-only/);
 }finally{f.dispose();}
});
test('oversized and unsupported private-key files show localized bounded errors without reading or reflecting input',async()=>{
 const f=fixture();try{await f.prepare();f.select('Способ SSH входа').props.onChange({target:{value:'private-key'}});f.render();let read=false;
  await f.input('Файл SSH приватного ключа').props.onChange({target:{files:[{size:65537,text:async()=>{read=true;return 'SECRET';}}]}});await flush();f.render();assert.equal(read,false);assert.match(f.text(),/64 КиБ/);assert.equal(f.button('Подключить сервер').props.disabled,true);
  await f.input('Файл SSH приватного ключа').props.onChange({target:{files:[{size:100,text:async()=> 'UNSUPPORTED-SECRET'}]}});await flush();f.render();assert.match(f.text(),/Некорректный SSH приватный ключ/);assert.doesNotMatch(f.text(),/UNSUPPORTED-SECRET/);
 }finally{f.dispose();}
});
test('generated key must be downloaded before explicit authorization; successful installation clears secrets and asks for saved file',async()=>{
 const f=fixture();try{await f.prepare();f.button('Создать SSH ключ').props.onClick();await flush();f.render();assert.equal(f.button('Установить созданный ключ на VPS').props.disabled,true);
  f.button('Скачать приватный ключ').props.onClick();f.render();assert.deepEqual(f.downloads,['castlink-root-ssh.pem']);assert.equal(f.button('Установить созданный ключ на VPS').props.disabled,false);
  f.button('Установить созданный ключ на VPS').props.onClick();await flush();f.render();const submit=f.submissions.find(input=>input.action==='authorize-key');assert.match(submit.generatedPrivateKey,/fixture-generated-key/);assert.equal(submit.password,'fixture-password-memory-only');assert.equal(submit.fingerprint,'SHA256:'+'A'.repeat(43));
  assert.match(f.text(),/SSH ключ установлен и вход проверен/);assert.equal(f.select('Способ SSH входа').props.value,'private-key');assert.equal(f.button('Подключить сервер').props.disabled,true);assert.equal(f.button('Скачать приватный ключ'),undefined);assert.doesNotMatch(f.text(),/fixture-generated-key|fixture-password-memory-only/);
 }finally{f.dispose();}
});
test('a late generated-key response cannot restore a secret after the room changes',async()=>{
 const f=fixture();try{await f.prepare();const pending=deferred();f.setGeneratePending(pending);f.button('Создать SSH ключ').props.onClick();f.setRoom('Another');f.render();await flush();f.render();
  pending.resolve(Response.json({privateKey:'STALE-GENERATED-SECRET',publicKey:'ssh-rsa public'}));await flush();f.render();assert.equal(f.button('Скачать приватный ключ'),undefined);assert.doesNotMatch(f.text(),/STALE-GENERATED-SECRET/);
 }finally{f.dispose();}
});
