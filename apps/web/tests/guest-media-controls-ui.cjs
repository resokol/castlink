require('./i18n-fixture.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
Module._extensions['.ts']=Module._extensions['.tsx']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
let context;
const react={
  useId(){return 'capture-test';},
  useState(initial){const scope=context,i=scope.cursor++;if(!(i in scope.hooks))scope.hooks[i]=typeof initial==='function'?initial():initial;scope.setters[i] ||= value=>{scope.hooks[i]=typeof value==='function'?value(scope.hooks[i]):value;};return[scope.hooks[i],scope.setters[i]];},
  useRef(initial){const scope=context,i=scope.cursor++;scope.hooks[i] ||= {current:initial};return scope.hooks[i];},
  useEffect(effect,deps){const scope=context,i=scope.cursor++,old=scope.hooks[i];if(!old||deps.some((value,j)=>value!==old.deps[j]))scope.effects.push(()=>{old?.cleanup?.();scope.hooks[i]={deps,cleanup:effect()};});},
};
function renderer(component){const scope={cursor:0,hooks:[],setters:[],effects:[]};return{render(props){context=scope;scope.cursor=0;const tree=component(props);while(scope.effects.length)scope.effects.shift()();return tree;},unmount(){for(const hook of scope.hooks)hook?.cleanup?.();}};}
const originalLoad=Module._load;
Module._load=function(name,...rest){if(name==='react')return react;if(name==='react/jsx-runtime')return{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};return originalLoad.call(this,name,...rest);};
const {GuestCameraCaptureControls}=require('../components/GuestCameraCaptureControls.tsx');
const {StudioGuestMediaControls}=require('../components/StudioGuestMediaControls.tsx');
const {StudioGuestMediaPanel}=require('../components/StudioGuestMediaPanel.tsx');
Module._load=originalLoad;
const nodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const timers=new Set();
global.setInterval=fn=>{timers.add(fn);return fn;};global.clearInterval=fn=>timers.delete(fn);
const commands=[];
let view={participantSid:'PA-1',state:{micGain:100,listenGain:100,screenShareEnabled:true,audioProfile:'speech',connectionRoute:'auto',activeRoute:'normal',videoCodec:'vp8',actualVideoCodec:'vp8',videoEnabled:true,supportedVideoCodecs:['vp8','h264']},connectionRoutes:{relay:{configured:false}}};
global.fetch=async(url,options)=>{
  if(options?.method==='POST'){const request=JSON.parse(options.body);commands.push(request);return{ok:true,json:async()=>({requested:true,command:{id:'command-one',participantSid:'PA-1',issuedAt:Date.now(),expiresAt:Date.now()+60000,patch:request.patch}})};}
  return{ok:true,json:async()=>view};
};
const pulse=async()=>{for(const timer of timers)timer();await settle();};

(async()=>{
  const panel=renderer(StudioGuestMediaPanel),controls=renderer(StudioGuestMediaControls);
  let props={studioId:'studio-one',roomName:'room-one',guests:[{identity:'guest-one',name:'Guest'}],renderGuest:(guest,controls,quickControls)=>({type:'article',props:{'data-guest':guest.identity,children:[quickControls,controls]}})};
  let tree=panel.render(props),child=nodes(tree).find(node=>node.type===StudioGuestMediaControls);
  let controlsTree=controls.render(child.props);await settle();controlsTree=controls.render(child.props);
  assert.equal(nodes(controlsTree).find(node=>node.type==='option'&&node.props.value==='h265')?.props.disabled,true,'H265 stays visible but disabled when guest lacks encoding support');
  view={...view,state:{...view.state,supportedVideoCodecs:['vp8','h264','h265']}};await pulse();controlsTree=controls.render(child.props);
  assert.equal(nodes(controlsTree).find(node=>node.type==='option'&&node.props.value==='h265')?.props.disabled,false,'guest capabilities enable H265 independently of studio browser');
  assert.ok(nodes(controlsTree).some(node=>node.type==='article'&&node.props['data-guest']==='guest-one'), 'settings must render inside the guest card, not a separate panel');
  assert.equal(nodes(controlsTree).find(node=>node.type==='article').props.children[0].type,'button','existing screen-stop action has a quick-control slot outside advanced settings');
  const micGain=nodes(controlsTree).find(node=>node.type==='input'&&node.props['aria-label']==='Уровень микрофона гостя');
  const outputGain=nodes(controlsTree).find(node=>node.type==='input'&&node.props['aria-label']==='Громкость звука у гостя');
  assert.equal(micGain.props.max,200);assert.equal(outputGain.props.max,100);
  micGain.props.onChange({target:{value:'65'}});controlsTree=controls.render(child.props);assert.equal(commands.length,0,'drag previews never send unbounded remote requests');
  nodes(controlsTree).find(node=>node.type==='input'&&node.props['aria-label']==='Уровень микрофона гостя').props.onPointerUp({currentTarget:{value:'65'}});await settle();controlsTree=controls.render(child.props);assert.deepEqual(commands.at(-1).patch,{micGain:65});assert.equal(nodes(controlsTree).find(node=>node.type==='input').props.value,100,'pending gain retains confirmed value until guest ACK');
  await pulse();controlsTree=controls.render(child.props);nodes(controlsTree).find(node=>node.type==='input'&&node.props['aria-label']==='Громкость звука у гостя').props.onKeyUp({key:'ArrowLeft',currentTarget:{value:'40'}});await settle();assert.deepEqual(commands.at(-1).patch,{listenGain:40});
  await pulse();controlsTree=controls.render(child.props);nodes(controlsTree).find(node=>node.type==='button'&&node.props.children==='Остановить показ экрана гостя').props.onClick();await settle();assert.deepEqual(commands.at(-1).patch,{screenShareEnabled:false});
  await pulse();controlsTree=controls.render(child.props);
  const microphone=nodes(controlsTree).find(node=>node.type==='select'&&node.props['aria-label']==='Режим микрофона Guest');
  const route=nodes(controlsTree).find(node=>node.type==='select'&&node.props['aria-label']==='Маршрут подключения Guest');
  assert.equal(microphone.props.value,'speech');assert.equal(microphone.props.disabled,false);
  assert.equal(nodes(route).find(node=>node.props?.value==='relay').props.disabled,true,'TURN selection disabled without server capability');
  const codec=nodes(controlsTree).find(node=>node.type==='select'&&node.props['aria-label']==='Видеокодек Guest');
  assert.equal(codec.props.value,'vp8');assert.equal(codec.props.disabled,false);assert.equal(nodes(codec).find(node=>node.props?.value==='av1').props.disabled,true,'unsupported sender codec is disabled');
  codec.props.onChange({target:{value:'h264'}});await settle();controlsTree=controls.render(child.props);
  assert.deepEqual(commands.at(-1).patch,{videoCodec:'h264'});assert.equal(nodes(controlsTree).find(node=>node.type==='select'&&node.props['aria-label']==='Видеокодек Guest').props.value,'vp8','request never impersonates actual confirmed codec');
  microphone.props.onChange({target:{value:'raw'}});await settle();controlsTree=controls.render(child.props);
  assert.deepEqual(commands.at(-1).patch,{audioProfile:'raw'});assert.equal(commands.at(-1).participantSid,'PA-1');
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
  const layoutPanel=renderer(StudioGuestMediaPanel);
  let layoutItems;
  const sceneProps={studioId:'studio-one',roomName:'room-one',guests:[{identity:'guest-scene',name:'Scene'}],renderGuest:(guest,controls,quickControls)=>({type:'article',props:{children:[controls,quickControls]}}),renderItems:items=>{layoutItems=items;return {type:'scene',props:{children:items.map(item=>item.node)}};}};
  const layoutTree=layoutPanel.render(sceneProps);
  assert.equal(layoutTree.type,'scene','source layout wraps the existing command controller nodes');
  assert.equal(layoutItems[0].guest.identity,'guest-scene');
  assert.equal(layoutItems[0].node.type,StudioGuestMediaControls,'layout reuses one controller for each camera');
  assert.equal(layoutPanel.render({...sceneProps,guests:[]}).type,'scene','the scene remains available for staff and screens when no guests are connected');
  layoutPanel.unmount();
  const capture=renderer(GuestCameraCaptureControls),captureCommands=[];
  let captureProps={name:'Guest',disabled:false,state:{cameraCaptureSupported:true,videoEnabled:true,cameraCapture:{mode:'device',resolution:'1920x1080',frameRate:'30'},actualCameraCapture:{width:1280,height:720,frameRate:29.97}},onChange:patch=>captureCommands.push(patch)};
  const byLabel=(tree,label)=>nodes(tree).find(node=>node.type==='select'&&node.props['aria-label']===label);
  const button=(tree,label)=>nodes(tree).find(node=>node.type==='button'&&node.props.children===label);
  let captureTree=capture.render(captureProps);
  assert.equal(byLabel(captureTree,'Разрешение камеры — Guest').props.disabled,true,'device defaults lock custom inputs');
  byLabel(captureTree,'Режим камеры — Guest').props.onChange({target:{value:'custom'}});
  captureTree=capture.render(captureProps);
  byLabel(captureTree,'Разрешение камеры — Guest').props.onChange({target:{value:'1280x720'}});
  captureTree=capture.render(captureProps);
  byLabel(captureTree,'Частота кадров камеры — Guest').props.onChange({target:{value:'29.97'}});
  captureTree=capture.render(captureProps);
  assert.equal(captureCommands.length,0,'editing capture draft sends no remote command');
  assert.equal(button(captureTree,'Применить').props.disabled,false);
  button(captureTree,'Отмена').props.onClick();captureTree=capture.render(captureProps);
  assert.equal(byLabel(captureTree,'Режим камеры — Guest').props.value,'device');
  assert.equal(button(captureTree,'Применить').props.disabled,true,'cancel restores confirmed settings');
  byLabel(captureTree,'Режим камеры — Guest').props.onChange({target:{value:'custom'}});
  captureTree=capture.render(captureProps);button(captureTree,'Применить').props.onClick();
  assert.deepEqual(captureCommands,[{cameraCapture:{mode:'custom',resolution:'1920x1080',frameRate:'30'}}]);
  assert.ok(nodes(captureTree).some(node=>node.type==='output'&&node.props.children.includes('1280 × 720')),'actual capture stays distinct from the draft');
  captureTree=capture.render({...captureProps,disabled:true});
  assert.equal(button(captureTree,'Применить').props.disabled,true,'pending commands lock submission');
  captureTree=capture.render({...captureProps,state:{...captureProps.state,videoEnabled:false}});
  assert.ok(nodes(captureTree).some(node=>node.type==='output'&&node.props.children==='Камера выключена'),'off camera never displays stale actual values');
  captureTree=capture.render({...captureProps,state:{audioProfile:'speech',connectionRoute:'auto'}});
  assert.ok(nodes(captureTree).filter(node=>node.type==='select').every(node=>node.props.disabled),'old guests cannot receive unsupported capture commands');
  capture.unmount();
  console.log('PASS: confirmed guest controls, draft/apply/cancel camera settings, actual capture, pending/offline/old-client states and cleanup');
})().catch(error=>{console.error(error);process.exitCode=1;});
