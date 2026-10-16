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
Module._load=function(name,...rest){if(name==='@/lib/camera-transform')return require('../lib/camera-transform.ts');if(name==='react')return react;if(name==='react/jsx-runtime')return{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};return originalLoad.call(this,name,...rest);};
const {StudioGuestDeviceControls}=require('../components/StudioGuestDeviceControls.tsx');
const {GuestDeviceRequestDialog}=require('../components/GuestDeviceRequestDialog.tsx');
Module._load=originalLoad;
const nodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const timers=new Set();global.setInterval=fn=>{timers.add(fn);return fn;};global.clearInterval=fn=>timers.delete(fn);
const commands=[];const state={devices:[{kind:'audioinput',deviceId:'mic-old',label:'Old microphone'},{kind:'audioinput',deviceId:'mic-new',label:'New microphone'},{kind:'videoinput',deviceId:'cam',label:'Camera'},{kind:'audiooutput',deviceId:'speaker',label:'Headphones'}],selected:{audioinput:'mic-old',videoinput:'cam'},actual:{audioinput:'mic-old'},microphoneEnabled:true,cameraEnabled:false,outputSupported:false};
let view={participantSid:'PA-1',state},readGate,requestGate;
global.fetch=async(url,options)=>{if(options?.method==='POST'){const command=JSON.parse(options.body);commands.push(command);if(requestGate){const wait=requestGate;requestGate=undefined;await wait;}return{ok:true,json:async()=>({request:{id:'request-one',participantSid:'PA-1',issuedAt:Date.now(),expiresAt:Date.now()+60000,target:command.target}})};}const snapshot=view;if(readGate){const wait=readGate;readGate=undefined;await wait;}return{ok:true,json:async()=>snapshot};};
const documentListeners=new Map();let restored=0;global.document={activeElement:{isConnected:true,focus:()=>restored++},addEventListener:(type,fn)=>documentListeners.set(type,fn),removeEventListener:(type,fn)=>{if(documentListeners.get(type)===fn)documentListeners.delete(type);}};
(async()=>{
 const controls=renderer(StudioGuestDeviceControls),props={studioId:'one',roomName:'one',identity:'guest-one',name:'Guest'};
 controls.render(props);await settle();let tree=controls.render(props);
 const selects=nodes(tree).filter(node=>node.type==='select');assert.equal(selects.length,3);assert.equal(selects[0].props.value,'mic-old');assert.equal(selects[0].props.disabled,false);assert.equal(selects[2].props.disabled,true,'browser output capability disables selection');
 let releaseRead;readGate=new Promise(resolve=>releaseRead=resolve);for(const fn of timers)fn();await settle();
 selects[0].props.onChange({target:{value:'mic-new'}});await settle();tree=controls.render(props);assert.equal(commands[0].action,'request');assert.equal(commands[0].participantSid,'PA-1');assert.deepEqual(commands[0].target,state.devices[1]);assert.equal(nodes(tree).find(node=>node.type==='select').props.value,'mic-old','requested selection retains confirmed old value');assert.ok(nodes(tree).some(node=>node.props?.role==='status'&&node.props.children==='Ожидаем решения кастера…'));
 releaseRead();await settle();tree=controls.render(props);assert.ok(nodes(tree).some(node=>node.props?.role==='status'&&node.props.children==='Ожидаем решения кастера…'),'slow inventory read must not clear a newer pending command');
 view={...view,request:undefined,result:{id:'request-one',outcome:'declined'}};for(const fn of timers)fn();await settle();tree=controls.render(props);assert.ok(nodes(tree).some(node=>node.props?.role==='status'&&node.props.children==='Кастер отклонил запрос'));
 view={participantSid:'PA-2'};for(const fn of timers)fn();await settle();tree=controls.render(props);assert.ok(nodes(tree).filter(node=>node.type==='select').every(node=>node.props.disabled),'fresh session without inventory disables all devices');
 view={participantSid:'PA-2',state};for(const fn of timers)fn();await settle();tree=controls.render(props);
 let releaseRequest;requestGate=new Promise(resolve=>releaseRequest=resolve);nodes(tree).find(node=>node.type==='select').props.onChange({target:{value:'mic-new'}});await settle();
 const otherProps={...props,identity:'guest-other'};view={participantSid:'PA-3',state};controls.render(otherProps);await settle();releaseRequest();await settle();tree=controls.render(otherProps);
 assert.ok(nodes(tree).filter(node=>node.type==='select').every(node=>!node.props.disabled||node.props['aria-label'].startsWith('Выход звука')),'a previous caster command must not install its pending state after changing caster');controls.unmount();
 const dialog=renderer(GuestDeviceRequestDialog),decisions=[],request={id:'dialog',participantSid:'PA-1',issuedAt:Date.now(),expiresAt:Date.now()+60000,target:state.devices[1]},dialogProps={request,applying:false,onRespond:accepted=>decisions.push(accepted)};
 tree=dialog.render(dialogProps);assert.ok(nodes(tree).some(node=>node.props?.role==='dialog'&&node.props['aria-modal']==='true'));assert.ok(nodes(tree).some(node=>node.type==='strong'&&node.props.children==='New microphone'));
 let buttons=nodes(tree).filter(node=>node.type==='button');buttons[0].props.onClick();buttons[1].props.onClick();assert.deepEqual(decisions,[false,true]);
 documentListeners.get('keydown')({key:'Escape',preventDefault(){}});assert.equal(decisions.at(-1),false,'Escape explicitly declines');tree=dialog.render({...dialogProps,applying:true});buttons=nodes(tree).filter(node=>node.type==='button');assert.ok(buttons.every(button=>button.props.disabled));const previousCount=decisions.length;documentListeners.get('keydown')({key:'Escape',preventDefault(){}});assert.equal(decisions.length,previousCount,'Escape cannot cancel an applying mutation');dialog.unmount();assert.equal(restored,1);assert.equal(documentListeners.size,0);assert.equal(timers.size,0);
 console.log('PASS: confirmed SID/device names, old selection retained until ACK, stale GET/previous-caster POST cannot overwrite new state, unsupported/rejoined states disabled, decline status, consent dialog Escape/busy guard/focus restoration and cleanup');
})().catch(error=>{console.error(error);process.exitCode=1;});
