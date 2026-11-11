const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
function fixture(component='RecoveryCode',props={peerId:'peer-room',room:'Room',studioId:'studio-default'},{profiles=[]}={}){
 const file=path.join(__dirname,'../components/'+component+'.tsx');
 assert.ok(fs.existsSync(file),component+' recovery UI is not implemented');
 let cursor=0,tree,dirty=false,disposed=false,lateUpdates=0,clock=1800000000000,timerId=0,nextResponse,copyFailure=false;
 const hooks=[],effects=[],timers=new Map(),requests=[],copied=[],focused=[];
 const react={
  useState(initial){const i=cursor++;hooks[i]??={value:typeof initial==='function'?initial():initial};return[hooks[i].value,next=>{if(disposed)lateUpdates++;const value=typeof next==='function'?next(hooks[i].value):next;if(value!==hooks[i].value){hooks[i].value=value;dirty=true;}}];},
  useRef(initial){return hooks[cursor++]??={current:initial};},
  useEffect(effect,deps){const i=cursor++,old=hooks[i];if(!old||deps.some((value,j)=>!Object.is(value,old.deps[j])))effects.push(()=>{old?.cleanup?.();hooks[i]={deps,cleanup:effect()};});}
 };
 const jsx=(type,props)=>({type,props}),module={exports:{}},RecoveryCode=()=>null;
 const t=(source,params)=>source.replace(/\{(\w+)\}/g,(match,key)=>params?.[key]??match);
 const context={module,exports:module.exports,require:name=>name==='react'?react:name==='react/jsx-runtime'?{jsx,jsxs:jsx,Fragment:'fragment'}:name.endsWith('.module.css')?{default:{}}:name.includes('I18nProvider')?{useI18n:()=>({t,locale:'ru'})}:name.includes('RecoveryCode')?{RecoveryCode}:name.includes('i18n/management')?{translateManagementMessage:(message)=>message}:require(name),
  fetch:(url,options={})=>{const body=options.body?JSON.parse(options.body):undefined;requests.push({url,options,body});if(nextResponse){const response=nextResponse;nextResponse=undefined;return response;}return Promise.resolve(Response.json(body?.action==='issue'?{code:'SECRET-RECOVERY-CODE',expiresAt:clock+600000}:body?.action==='revoke'?{revoked:true}:{profiles}));},
  navigator:{clipboard:{writeText:async code=>{if(copyFailure)throw Error('Clipboard refused');copied.push(code);}}},
  AbortController,AbortSignal,Date:class extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}},
  setTimeout(callback,delay){const id=++timerId;timers.set(id,{callback,at:clock+delay});return id;},clearTimeout:id=>timers.delete(id),console:{error(){throw Error('Recovery UI must not log');},log(){throw Error('Recovery UI must not log');}},
 };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context,{filename:file});
 function render(next){if(next)props={...props,...next};for(let attempts=0;attempts<12;attempts++){dirty=false;cursor=0;tree=module.exports[component](props);while(effects.length)effects.shift()();if(!dirty)break;}for(const node of nodes())if(node.props?.ref)node.props.ref.current={focus:()=>focused.push(text(node))};return tree;}
 const nodes=(node=tree,out=[])=>{if(Array.isArray(node))node.forEach(child=>{if(child!==undefined)nodes(child,out);});else if(node&&typeof node==='object'){out.push(node);if(node.props?.children!==undefined)nodes(node.props.children,out);}return out;};
 const text=node=>Array.isArray(node)?node.map(text).join(''):node&&typeof node==='object'?text(node.props?.children):String(node??'');
 const button=label=>nodes().find(node=>node.type==='button'&&text(node)===label);
 async function click(label){const target=button(label);assert.ok(target,'Missing button: '+label);assert.ok(!target.props.disabled,'Disabled button: '+label);await target.props.onClick();await flush();render();}
 return{render,nodes,button,click,requests,copied,focused,text:()=>text(tree),hooks,respondWith:promise=>nextResponse=promise,failCopy(){copyFailure=true;},advance(ms){clock+=ms;for(const[id,timer]of timers)if(timer.at<=clock){timers.delete(id);timer.callback();}render();},dispose(){disposed=true;for(const hook of hooks)hook?.cleanup?.();},lateUpdates:()=>lateUpdates};
}
test('room issuer discloses new-PC recovery and posts only its existing room peer',async()=>{
 const f=fixture();try{
  f.render();assert.equal(f.requests.length,0);assert.equal(f.button('Восстановить связь').props['aria-expanded'],false);await f.click('Восстановить связь');assert.equal(f.button('Восстановить связь').props['aria-expanded'],true);assert.match(f.text(),/новом компьютере/);assert.match(f.text(),/10 минут/);
  await f.click('Создать код на 10 минут');assert.equal(f.requests.length,1);const request=f.requests[0];assert.equal(request.url,'/api/server-recovery');assert.equal(request.options.method,'POST');assert.equal(request.options.cache,'no-store');assert.equal(request.options.credentials,'same-origin');assert.deepEqual(request.body,{action:'issue',peerId:'peer-room',room:'Room',studioId:'studio-default'});
  const code=f.nodes().find(node=>node.type==='textarea');assert.equal(code.props.value,'SECRET-RECOVERY-CODE');assert.equal(code.props['aria-label'],'Код восстановления');assert.equal(code.props.readOnly,true);assert.equal(code.props.autoComplete,'off');assert.match(f.text(),/Действует до/);
  await f.click('Скопировать код');assert.deepEqual(f.copied,['SECRET-RECOVERY-CODE']);assert.match(f.text(),/Код скопирован/);
  await f.click('Отозвать код');assert.equal(f.requests[1].body.action,'revoke');assert.equal(f.nodes().find(node=>node.type==='textarea'),undefined);assert.doesNotMatch(JSON.stringify(f.hooks),/SECRET-RECOVERY-CODE/);assert.match(f.text(),/Код отозван/);
 }finally{f.dispose();}
});
test('expiry removes the code and permits another issue without retaining the secret',async()=>{
 const f=fixture();try{f.render();await f.click('Восстановить связь');await f.click('Создать код на 10 минут');f.advance(600000);assert.equal(f.nodes().find(node=>node.type==='textarea'),undefined);assert.doesNotMatch(JSON.stringify(f.hooks),/SECRET-RECOVERY-CODE/);assert.match(f.text(),/Срок действия кода истёк/);assert.ok(f.button('Создать код на 10 минут'));}finally{f.dispose();}
});
test('a recovery code carrying a valid source CA may exceed 32 KiB',async()=>{
 const f=fixture(),prefix='castlink-recovery-v1.',code=prefix+'A'.repeat(40000-prefix.length);
 try{f.render();await f.click('Восстановить связь');f.respondWith(Promise.resolve(Response.json({code,expiresAt:1800000600000})));await f.click('Создать код на 10 минут');const field=f.nodes().find(node=>node.type==='textarea');assert.ok(field,'A valid code with a source CA was rejected');assert.equal(field.props.value,code);}finally{f.dispose();}
});
test('closing clears an issued code and ignores an issue response arriving after close',async()=>{
 const f=fixture();try{
  f.render();await f.click('Восстановить связь');await f.click('Создать код на 10 минут');await f.click('Закрыть');assert.deepEqual(f.focused,['Восстановить связь']);assert.doesNotMatch(JSON.stringify(f.hooks),/SECRET-RECOVERY-CODE/);
  await f.click('Восстановить связь');const pending=deferred();f.respondWith(pending.promise);const issuing=f.click('Создать код на 10 минут');f.render();await f.click('Закрыть');pending.resolve(Response.json({code:'LATE-CODE',expiresAt:1800000600000}));await issuing;assert.equal(f.nodes().find(node=>node.type==='textarea'),undefined);assert.doesNotMatch(JSON.stringify(f.hooks),/LATE-CODE/);
 }finally{f.dispose();}
});
test('peer, room and studio changes discard codes and reject stale asynchronous responses',async()=>{
 for(const changed of [{peerId:'peer-other'},{room:'Other Room'},{studioId:'other-studio'}]){
  const f=fixture();try{f.render();await f.click('Восстановить связь');await f.click('Создать код на 10 минут');f.render(changed);assert.equal(f.nodes().find(node=>node.type==='textarea'),undefined);assert.doesNotMatch(JSON.stringify(f.hooks),/SECRET-RECOVERY-CODE/);
   await f.click('Восстановить связь');const pending=deferred();f.respondWith(pending.promise);const issuing=f.click('Создать код на 10 минут');f.render();f.render({peerId:'another-peer',room:'another-room',studioId:'another-studio'});pending.resolve(Response.json({code:'STALE-CONTEXT-CODE',expiresAt:1800000600000}));await issuing;assert.doesNotMatch(JSON.stringify(f.hooks),/STALE-CONTEXT-CODE/);
  }finally{f.dispose();}
 }
});
test('unmount aborts an in-flight issue and does not update component state after it resolves',async()=>{
 const f=fixture();f.render();await f.click('Восстановить связь');const pending=deferred();f.respondWith(pending.promise);const issuing=f.click('Создать код на 10 минут');f.render();f.dispose();assert.equal(f.requests[0].options.signal.aborted,true);pending.resolve(Response.json({code:'UNMOUNTED-CODE',expiresAt:1800000600000}));await issuing;assert.equal(f.lateUpdates(),0);
});
test('API errors are retryable and clipboard denial keeps a manually selectable code',async()=>{
 const f=fixture();try{f.render();await f.click('Восстановить связь');f.respondWith(Promise.resolve(Response.json({error:'Доступ создателя комнаты не подтверждён'},{status:403})));await f.click('Создать код на 10 минут');assert.ok(f.nodes().find(node=>node.props?.role==='alert'));assert.ok(f.button('Создать код на 10 минут'));await f.click('Создать код на 10 минут');f.failCopy();await f.click('Скопировать код');assert.ok(f.nodes().find(node=>node.type==='textarea'));assert.match(f.text(),/Скопируй код из поля/);}finally{f.dispose();}
});
test('Super Admin catalog exposes installation recovery only and never sends room credentials',async()=>{
 const f=fixture('ServerRecoveryConnections',{}, {profiles:[{id:'global',label:'Global',origin:'https://one.example',scope:'installation'},{id:'room-peer',label:'Room only',origin:'https://two.example',scope:'room'}]});
 try{f.render();await flush();f.render();assert.equal(f.requests[0].url,'/api/server-recovery');assert.equal(f.requests[0].options.cache,'no-store');const issuers=f.nodes().filter(node=>typeof node.type==='function'&&node.type.name==='RecoveryCode');assert.equal(issuers.length,1);assert.equal(issuers[0].props.peerId,'global');assert.equal(issuers[0].props.room,undefined);assert.equal(issuers[0].props.studioId,undefined);assert.doesNotMatch(f.text(),/Room only/);}finally{f.dispose();}
});
