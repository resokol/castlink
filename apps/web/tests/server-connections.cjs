require('./i18n-fixture.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject};}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture({profiles=[]}={}){
 const hooks=[],effects=[],intervals=new Map(),deadlines=[],polls=[];let cursor=0,tree,onChange=()=>{},timerId=0,startPending,generatePending,fingerprintPending,removePending,room='Room';const submissions=[],downloads=[],requests=[];
 const react={
  useState(initial){const i=cursor++;if(!hooks[i])hooks[i]={value:typeof initial==='function'?initial():initial};return [hooks[i].value,value=>{hooks[i].value=typeof value==='function'?value(hooks[i].value):value;}];},
  useRef(initial){const i=cursor++;if(!hooks[i])hooks[i]={current:initial};return hooks[i];},
  useEffect(effect,deps){const i=cursor++,old=hooks[i];if(!old||deps.some((value,index)=>value!==old.deps[index])){effects.push(()=>{old?.cleanup?.();hooks[i]={deps,cleanup:effect()};});}}
 };
 const request=(url,options={})=>{
  const input=options.body?JSON.parse(options.body):null;
  if(input)requests.push(input);
  if(input?.action==='fingerprint')return fingerprintPending?.promise||Promise.resolve(Response.json({fingerprint:'SHA256:'+'A'.repeat(43)}));
  if(input)submissions.push(input);
  if(options.method==='DELETE')return removePending?.promise||Promise.resolve(Response.json({removed:true}));
  if(input?.action==='generate-key')return generatePending?.promise||Promise.resolve(Response.json({privateKey:'-----BEGIN RSA PRIVATE KEY-----\nfixture-generated-key\n-----END RSA PRIVATE KEY-----',publicKey:'ssh-rsa fixture-public'}));
  if(input?.action==='authorize-key')return Promise.resolve(Response.json({ok:true}));
  if(input?.action==='start'||input?.action==='update'){
   if(startPending){options.signal?.addEventListener('abort',()=>startPending.reject(options.signal.reason),{once:true});return startPending.promise;}
   return Promise.resolve(Response.json({id:'job-1',state:'running',stage:input.action==='update'?'Проверяем установленную версию':'connecting'}));
  }
  if(url.includes('jobId=')){
   const pending=deferred();polls.push({pending,signal:options.signal});options.signal?.addEventListener('abort',()=>pending.reject(options.signal.reason),{once:true});return pending.promise;
  }
  return Promise.resolve(Response.json({profiles}));
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
 return {render,begin,prepare,input,button,nodes,submissions,requests,downloads,select(label){return nodes(nodes().find(node=>node.type==='label'&&text(node).startsWith(label))).find(node=>node.type==='select');},setRoom(value){room=value;},setRemovePending(value){removePending=value;},setGeneratePending(value){generatePending=value;},setFingerprintPending(value){fingerprintPending=value;},polls,deadlines,intervals,text:()=>text(tree),setStartPending(value){startPending=value;},dispose(){for(const hook of hooks)hook?.cleanup?.();}};
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

const updateProfile={id:'peer-vps',label:'My VPS',origin:'https://8.8.8.8',scope:'room',update:{host:'8.8.8.8',port:22,installationId:'approved-installation'}};
async function chooseUpdate(f){f.render();await flush();f.render();const choose=f.button('Обновить');assert.ok(choose,'Eligible room VPS has no update action');choose.props.onClick();f.render();}
async function prepareUpdate(f){await chooseUpdate(f);f.button('Проверить SSH ключ сервера').props.onClick();await flush();f.render();f.nodes().find(node=>node.type==='input'&&node.props.type==='checkbox').props.onChange({target:{checked:true}});f.input('SSH пароль').props.onChange({target:{value:'update-password-memory-only'}});f.render();}
test('update action is offered only for eligible room profiles and uses locked profile identity',async()=>{
 const f=fixture({profiles:[updateProfile,{...updateProfile,id:'global',scope:'installation'},{id:'unsupported',label:'Other',origin:'https://example.org',scope:'room'}]});
 try{await prepareUpdate(f);assert.equal(f.nodes().filter(node=>node.type==='button'&&node.props.children==='Обновить').length,1);assert.equal(f.input('Публичный IPv4').props.value,'8.8.8.8');assert.equal(f.input('Публичный IPv4').props.readOnly,true);assert.equal(f.input('UUID нужной установки').props.value,'approved-installation');assert.equal(f.input('UUID нужной установки').props.readOnly,true);assert.match(f.text(),/Обновление прервёт работу VPS/);
  assert.equal(f.requests.find(input=>input.action==='fingerprint').peerId,'peer-vps');
  f.button('Обновить CastLink').props.onClick();await flush();f.render();const input=f.submissions.find(input=>input.action==='update');assert.ok(input);assert.equal(input.peerId,'peer-vps');assert.equal(input.host,'8.8.8.8');assert.equal(input.installationId,'approved-installation');assert.equal(input.mode,undefined);assert.equal(input.password,'update-password-memory-only');assert.equal(f.input('SSH пароль').props.value,'');assert.match(f.text(),/Обновляем…/);assert.doesNotMatch(f.text(),/Подключаем…/);
 }finally{f.dispose();}
});
test('changing an update SSH port or leaving its selection clears credentials and host trust',async()=>{
 const f=fixture({profiles:[updateProfile]});try{await prepareUpdate(f);f.input('SSH порт').props.onChange({target:{value:'2222'}});f.render();assert.equal(f.input('SSH пароль').props.value,'');assert.equal(f.nodes().some(node=>node.type==='input'&&node.props.type==='checkbox'),false);assert.equal(f.button('Обновить CastLink').props.disabled,true);
  f.input('SSH пароль').props.onChange({target:{value:'port-specific-secret'}});f.button('Вернуться к подключению').props.onClick();f.render();assert.equal(f.input('SSH пароль').props.value,'');assert.equal(f.input('Публичный IPv4').props.readOnly,false);assert.equal(f.button('Подключить сервер').props.disabled,true);
 }finally{f.dispose();}
});
test('update polling reports returned versions and completion instructions without reconnecting wording',async()=>{
 const f=fixture({profiles:[updateProfile]});try{await prepareUpdate(f);f.button('Обновить CastLink').props.onClick();await flush();f.render();f.polls[0].pending.resolve(Response.json({id:'job-1',state:'complete',stage:'Обновление проверено',previousBuildId:'old-build',targetBuildId:'new-build',buildId:'new-build',backup:'/opt/castlink-easy-approved/backups/web-abcdef123456-12345678',outcome:'updated'}));await flush();f.render();assert.match(f.text(),/old-build/);assert.match(f.text(),/new-build/);assert.match(f.text(),/backups\/web-abcdef123456-12345678/);assert.match(f.text(),/Заново подготовь резерв/);assert.doesNotMatch(f.text(),/Подключаем…/);
 }finally{f.dispose();}
});
test('lost update job reports unknown update status and keeps repeat action blocked by cleared credentials',async()=>{
 const f=fixture({profiles:[updateProfile]});try{await prepareUpdate(f);f.button('Обновить CastLink').props.onClick();await flush();f.render();f.polls[0].pending.resolve(Response.json({error:'not found'},{status:404}));await flush();f.render();assert.match(f.text(),/Статус обновления утрачен/);assert.doesNotMatch(f.text(),/готовый сервер подключи как установленный/);assert.equal(f.button('Обновить CastLink').props.disabled,true);
 }finally{f.dispose();}
});
test('late update start response cannot restore an old job after room context changes',async()=>{
 const f=fixture({profiles:[updateProfile]});try{await prepareUpdate(f);const pending=deferred();f.setStartPending(pending);f.button('Обновить CastLink').props.onClick();f.setRoom('Another');f.render();await flush();f.render();pending.resolve(Response.json({id:'old-job',state:'running',stage:'STALE UPDATE'}));await flush();f.render();assert.doesNotMatch(f.text(),/STALE UPDATE/);assert.equal(f.polls.length,0);assert.equal(f.input('SSH пароль').props.value,'');
 }finally{f.dispose();}
});
test('late SSH probe cannot restore trust information after the target address changes',async()=>{
 const f=fixture();try{f.render();await flush();f.render();f.input('Публичный IPv4').props.onChange({target:{value:'8.8.8.8'}});f.render();const pending=deferred();f.setFingerprintPending(pending);f.button('Проверить SSH ключ сервера').props.onClick();f.input('Публичный IPv4').props.onChange({target:{value:'1.1.1.1'}});f.render();pending.resolve(Response.json({fingerprint:'STALE-FINGERPRINT'}));await flush();f.render();assert.doesNotMatch(f.text(),/STALE-FINGERPRINT/);
 }finally{f.dispose();}
});
test('update reuses private-key authentication and clears its key/passphrase immediately',async()=>{
 const f=fixture({profiles:[updateProfile]});try{await prepareUpdate(f);f.select('Способ SSH входа').props.onChange({target:{value:'private-key'}});f.render();await f.input('Файл SSH приватного ключа').props.onChange({target:{files:[{size:120,text:async()=> '-----BEGIN OPENSSH PRIVATE KEY-----\nupdate-private-key-memory-only\n-----END OPENSSH PRIVATE KEY-----'}]}});await flush();f.render();f.input('Пароль ключа').props.onChange({target:{value:'update-passphrase-memory-only'}});f.render();f.button('Обновить CastLink').props.onClick();await flush();f.render();const input=f.submissions.find(input=>input.action==='update');assert.equal(input.authType,'private-key');assert.match(input.privateKey,/update-private-key-memory-only/);assert.equal(input.passphrase,'update-passphrase-memory-only');assert.equal(input.password,undefined);assert.equal(f.input('Пароль ключа').props.value,'');assert.doesNotMatch(f.text(),/update-private-key-memory-only|update-passphrase-memory-only/);
 }finally{f.dispose();}
});
test('switching to another approved VPS clears credentials and fingerprint from the previous selection',async()=>{
 const second={...updateProfile,id:'peer-second',label:'Second VPS',update:{host:'1.1.1.1',port:22,installationId:'second-installation'}};
 const f=fixture({profiles:[updateProfile,second]});try{await prepareUpdate(f);f.nodes().filter(node=>node.type==='button'&&node.props.children==='Обновить')[1].props.onClick();f.render();assert.equal(f.input('Публичный IPv4').props.value,'1.1.1.1');assert.equal(f.input('UUID нужной установки').props.value,'second-installation');assert.equal(f.input('SSH пароль').props.value,'');assert.equal(f.nodes().some(node=>node.type==='input'&&node.props.type==='checkbox'),false);assert.equal(f.button('Обновить CastLink').props.disabled,true);
 }finally{f.dispose();}
});
test('failed update and rollback status stays visible without a success or preparation reminder',async()=>{
 const f=fixture({profiles:[updateProfile]});try{await prepareUpdate(f);f.button('Обновить CastLink').props.onClick();await flush();f.render();f.polls[0].pending.resolve(Response.json({id:'job-1',state:'failed',stage:'Восстановлена предыдущая версия',error:'Обновление не прошло проверку',previousBuildId:'old-build',buildId:'old-build',outcome:'rolled-back'}));await flush();f.render();assert.match(f.text(),/Восстановлена предыдущая версия/);assert.match(f.text(),/Обновление не прошло проверку/);assert.doesNotMatch(f.text(),/Заново подготовь резерв/);assert.equal(f.button('Обновить CastLink').props.disabled,true);
 }finally{f.dispose();}
});
test('changing rooms while an update runs never polls the old job in the new room',async()=>{
 const f=fixture({profiles:[updateProfile]});try{await prepareUpdate(f);f.button('Обновить CastLink').props.onClick();await flush();f.render();assert.equal(f.polls.length,1);f.setRoom('Another');f.render();await flush();f.render();assert.equal(f.polls.length,1,'old update was polled using new room authorization');f.polls[0].pending.resolve(Response.json({id:'job-1',state:'complete',stage:'STALE COMPLETION'}));await flush();f.render();assert.doesNotMatch(f.text(),/STALE COMPLETION/);
 }finally{f.dispose();}
});
test('an old key generation reply cannot unlock controls during a new-room SSH probe',async()=>{
 const f=fixture({profiles:[updateProfile]});try{await f.prepare();const generated=deferred();f.setGeneratePending(generated);f.button('Создать SSH ключ').props.onClick();f.setRoom('Another');f.render();await flush();f.render();await chooseUpdate(f);const fingerprint=deferred();f.setFingerprintPending(fingerprint);f.button('Проверить SSH ключ сервера').props.onClick();f.render();generated.resolve(Response.json({privateKey:'OLD-GENERATED-SECRET',publicKey:'ssh-rsa old'}));await flush();f.render();assert.equal(f.button('Вернуться к подключению').props.disabled,true,'stale generation unlocked controls during the new SSH request');assert.doesNotMatch(f.text(),/OLD-GENERATED-SECRET/);fingerprint.resolve(Response.json({fingerprint:'SHA256:'+'A'.repeat(43)}));await flush();f.render();assert.equal(f.button('Вернуться к подключению').props.disabled,false);
 }finally{f.dispose();}
});

test('room connection removal needs confirmation, preserves shared connections and refreshes transfer catalog',async()=>{
 const peer={...updateProfile,label:'REMOVE-ROOM-PEER'},shared={...updateProfile,id:'installation-peer',label:'SHARED-INSTALLATION-PEER',scope:'installation'};
 const f=fixture({profiles:[peer,shared]});let changed=0;
 try{
  f.render(()=>{changed++;});await flush();f.render();
  assert.equal(f.nodes().filter(n=>n.type==='button'&&n.props.children==='Удалить подключение').length,1);
  f.button('Удалить подключение').props.onClick();f.render();assert.match(f.text(),/службы и данные на VPS сохранятся/);assert.equal(f.submissions.length,0);
  f.button('Отмена').props.onClick();f.render();assert.equal(f.submissions.length,0);
  f.button('Удалить подключение').props.onClick();f.render();f.button('Подтвердить удаление подключения').props.onClick();await flush();f.render();
  assert.deepEqual(JSON.parse(JSON.stringify(f.submissions[0])),{room:'Room',studioId:'studio-default',peerId:peer.id,confirm:true});
  assert.doesNotMatch(f.text(),/REMOVE-ROOM-PEER/);assert.match(f.text(),/SHARED-INSTALLATION-PEER/);assert.match(f.text(),/Подключение удалено из этой комнаты/);assert.equal(changed,1);
 }finally{f.dispose();}
});
test('prepared reserve refusal preserves connection; late deletion response cannot alter a new-room catalog',async()=>{
 const f=fixture({profiles:[updateProfile]});
 try{
  f.render();await flush();f.render();const refused=deferred();f.setRemovePending(refused);f.button('Удалить подключение').props.onClick();f.render();f.button('Подтвердить удаление подключения').props.onClick();
  refused.resolve(Response.json({error:'Сначала сними подготовленный резерв и дождись завершения переноса. Подключение сохранено.'},{status:409}));await flush();f.render();assert.match(f.text(),/Подключение сохранено/);assert.ok(f.button('Удалить подключение'));
  const late=deferred();f.setRemovePending(late);f.button('Подтвердить удаление подключения').props.onClick();f.setRoom('New room');f.render();await flush();f.render();late.resolve(Response.json({removed:true}));await flush();f.render();assert.ok(f.button('Удалить подключение'));assert.doesNotMatch(f.text(),/Подключение удалено из этой комнаты/);
 }finally{f.dispose();}
});
test('slow operation shows elapsed time and no-progress message while keeping completion unconfirmed',async()=>{
 const f=fixture({profiles:[updateProfile]});
 try{
  await prepareUpdate(f);f.button('Обновить CastLink').props.onClick();await flush();f.render();
  f.polls[0].pending.resolve(Response.json({id:'job-1',state:'running',stage:'Проверка контрольной суммы серверных компонентов',createdAt:Date.now()-125000,updatedAt:Date.now()-65000}));await flush();f.render();
  assert.match(f.text(),/Выполняется 12[45] сек/);assert.match(f.text(),/Новых данных о ходе операции пока нет/);assert.match(f.text(),/завершение ещё не подтверждено/);assert.doesNotMatch(f.text(),/Заново подготовь резерв/);
 }finally{f.dispose();}
});
