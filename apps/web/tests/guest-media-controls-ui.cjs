require('./i18n-fixture.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
Module._extensions['.tsx']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
let context;
const react={
  useState(initial){const scope=context,i=scope.cursor++;if(!(i in scope.hooks))scope.hooks[i]=typeof initial==='function'?initial():initial;scope.setters[i] ||= value=>{scope.hooks[i]=typeof value==='function'?value(scope.hooks[i]):value;};return[scope.hooks[i],scope.setters[i]];},
  useRef(initial){const scope=context,i=scope.cursor++;scope.hooks[i] ||= {current:initial};return scope.hooks[i];},
  useEffect(effect,deps){const scope=context,i=scope.cursor++,old=scope.hooks[i];if(!old||deps.some((value,j)=>value!==old.deps[j]))scope.effects.push(()=>{old?.cleanup?.();scope.hooks[i]={deps,cleanup:effect()};});},
};
function renderer(component){const scope={cursor:0,hooks:[],setters:[],effects:[]};return{render(props){context=scope;scope.cursor=0;const tree=component(props);while(scope.effects.length)scope.effects.shift()();return tree;},unmount(){for(const hook of scope.hooks)hook?.cleanup?.();}};}
const originalLoad=Module._load;
Module._load=function(name,...rest){if(name==='react')return react;if(name==='react/jsx-runtime')return{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};return originalLoad.call(this,name,...rest);};
const {StudioGuestMediaControls}=require('../components/StudioGuestMediaControls.tsx');
const {StudioGuestMediaPanel}=require('../components/StudioGuestMediaPanel.tsx');
Module._load=originalLoad;
const nodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const timers=new Set();
global.setInterval=fn=>{timers.add(fn);return fn;};global.clearInterval=fn=>timers.delete(fn);
const commands=[];
let view={participantSid:'PA-1',state:{audioProfile:'speech',connectionRoute:'auto',activeRoute:'normal'},connectionRoutes:{relay:{configured:false}}};
global.fetch=async(url,options)=>{
  if(options?.method==='POST'){const request=JSON.parse(options.body);commands.push(request);return{ok:true,json:async()=>({requested:true,command:{id:'command-one',participantSid:'PA-1',issuedAt:Date.now(),expiresAt:Date.now()+60000,patch:request.patch}})};}
  return{ok:true,json:async()=>view};
};
const pulse=async()=>{for(const timer of timers)timer();await settle();};

(async()=>{
  const panel=renderer(StudioGuestMediaPanel),controls=renderer(StudioGuestMediaControls);
  let props={studioId:'studio-one',roomName:'room-one',guests:[{identity:'guest-one',name:'Guest'}],renderGuest:(guest,controls)=>({type:'article',props:{'data-guest':guest.identity,children:controls}})};
  let tree=panel.render(props),child=nodes(tree).find(node=>node.type===StudioGuestMediaControls);
  let controlsTree=controls.render(child.props);await settle();controlsTree=controls.render(child.props);
  assert.ok(nodes(controlsTree).some(node=>node.type==='article'&&node.props['data-guest']==='guest-one'), 'settings must render inside the guest card, not a separate panel');
  const microphone=nodes(controlsTree).find(node=>node.type==='select'&&node.props['aria-label']==='Режим микрофона Guest');
  const route=nodes(controlsTree).find(node=>node.type==='select'&&node.props['aria-label']==='Маршрут подключения Guest');
  assert.equal(microphone.props.value,'speech');assert.equal(microphone.props.disabled,false);
  assert.equal(nodes(route).find(node=>node.props?.value==='relay').props.disabled,true,'TURN selection disabled without server capability');
  microphone.props.onChange({target:{value:'raw'}});await settle();controlsTree=controls.render(child.props);
  assert.deepEqual(commands[0].patch,{audioProfile:'raw'});assert.equal(commands[0].participantSid,'PA-1');
  assert.equal(nodes(controlsTree).find(node=>node.type==='select'&&node.props['aria-label']==='Режим микрофона Guest').props.value,'speech','accepted command retains last confirmed displayed value');
  assert.ok(nodes(controlsTree).some(node=>node.props?.role==='status'&&String(node.props.children).includes('Ожидаем подтверждение')));
  props={...props,guests:[]};tree=panel.render(props);child=nodes(tree).find(node=>node.type===StudioGuestMediaControls);assert.ok(child,'only pending controls survive guest video-card removal');assert.equal(child.props.connected,false);
  controlsTree=controls.render(child.props);assert.ok(nodes(controlsTree).some(node=>node.props?.role==='status'&&node.props.children==='Переподключение…'));
  view={offline:true,state:{audioProfile:'speech',connectionRoute:'auto'},result:{id:'command-one',ok:false,error:'TURN join failed'},connectionRoutes:{relay:{configured:false}}};
  await pulse();controlsTree=controls.render(child.props);tree=panel.render(props);
  assert.ok(nodes(controlsTree).some(node=>node.props?.role==='alert'&&node.props.children==='TURN join failed'));
  assert.equal(nodes(controlsTree).find(node=>node.type==='select').props.disabled,true);
  child=nodes(tree).find(node=>node.type===StudioGuestMediaControls);controlsTree=controls.render(child.props);const dismiss=nodes(controlsTree).find(node=>node.type==='button'&&node.props.children==='Закрыть сообщение');assert.ok(dismiss,'failed offline result remains dismissible');dismiss.props.onClick();assert.equal(panel.render(props),null);
  controls.unmount();assert.equal(timers.size,0,'dismissed controls stop polling');
  for(let i=0;i<14;i++){
    const identity=`guest-${i}`;props={...props,guests:[{identity,name:identity}]};tree=panel.render(props);nodes(tree).find(node=>node.type===StudioGuestMediaControls&&node.props.identity===identity).props.onActivity({pending:false,error:'failed'});
  }
  props={...props,guests:[]};tree=panel.render(props);assert.equal(nodes(tree).filter(node=>node.type===StudioGuestMediaControls).length,10,'recent offline failures have a hard bound');
  props={...props,roomName:'another-room'};panel.render(props);assert.equal(panel.render(props),null,'changing room clears retained command messages');panel.unmount();
  console.log('PASS: studio-only controls show confirmed state, disable unavailable TURN, retain pending status across disconnect, display failed ACK, dismiss/clear bounded messages and polling');
})().catch(error=>{console.error(error);process.exitCode=1;});
