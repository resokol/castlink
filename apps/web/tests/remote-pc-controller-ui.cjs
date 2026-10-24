const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{load}=require('./load-typescript.cjs');
let active,locale='ru',model,requests=0,finishes=0,texts=[];const hookCalls=[];
const jsx=(type,props)=>({type,props}),react={useRef(value){const s=active,i=s.cursor++;return s.hooks[i]??={current:value};},useState(value){const s=active,i=s.cursor++;if(!(i in s.hooks))s.hooks[i]=value;return[s.hooks[i],next=>s.hooks[i]=typeof next==='function'?next(s.hooks[i]):next];},useEffect(){}};
const i18n={useI18n:()=>({locale,t:x=>x})},useRemotePcTile=(...args)=>(hookCalls.push(args),model),mocks={react,'react/jsx-runtime':{jsx,jsxs:jsx},'./I18nProvider':i18n,'@/components/I18nProvider':i18n,'@/lib/use-remote-pc-tile':{useRemotePcTile},'./RemotePcOwnerStatus':{RemotePcOwnerStatus(){}}};
const {RemotePcTileControls}=load('../components/RemotePcTileControls.tsx',mocks),{RemotePcSourcePreview}=load('../components/RemotePcSourcePreview.tsx',mocks);
const file=ts.createSourceFile('RoomConference.tsx',fs.readFileSync(__dirname+'/../components/RoomConference.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let node;file.forEachChild(n=>{if(ts.isFunctionDeclaration(n)&&n.name?.text==='RotatedParticipantTile')node=n;});
const room={localParticipant:{identity:'guest-local',sid:'PA_local'}},publication={trackSid:'TR_video',track:{}},participant={identity:'guest-owner',sid:'PA_owner',isLocal:false},track={source:'screen_share',publication,participant};
const component=vm.runInNewContext(ts.transpileModule('('+node.getText(file)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText,{exports:{},...react,useI18n:i18n.useI18n,useRoomContext:()=>room,useEnsureTrackRef:x=>x,useVideoRotation(){},useRemotePcTile,useCoPresentationNavigation:()=>undefined,Track:{Source:{Camera:'camera',ScreenShare:'screen_share'}},RemotePcTileControls,RemotePcOwnerStatus(){},ParticipantTile(){},exitCssFullscreen(){},toggleElementFullscreen(){},require:()=>({jsx,jsxs:jsx})});
function render(component,props,scope={hooks:[]}){active=scope;scope.cursor=0;return{tree:component(props),scope};}
const walk=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(walk):[n,...walk(n.props?.children)];
const settle=()=>new Promise(setImmediate);
(async()=>{
 for(const surface of ['guest','staff']){
  model={available:false,requestable:true,sourceAvailable:true,request:async()=>requests++,stop:async()=>finishes++,text:async value=>texts.push(value),chord:async()=>{},active:false,focused:false};
  const result=surface==='guest'?render(component,{trackRef:track}):render(RemotePcSourcePreview,{room,resolved:{participant,publication},track:publication.track,enabled:true,title:'Screen'});
  assert.equal(hookCalls.at(-1)[2].publication,publication,'actual screen surface preserves exact SDK publication');
  const child=walk(result.tree).find(n=>n.type===RemotePcTileControls||n.type?.name==='RemotePcTileControls');assert.ok(child,`${surface} actual screen surface has controls`);
  let ui=render(RemotePcTileControls,child.props),nodes=walk(ui.tree),button=label=>nodes.find(n=>n.type==='button'&&n.props.children===label);
  await button('Запросить управление ПК').props.onClick();assert.equal(requests,surface==='guest'?1:2);
  model.pending=true;nodes=walk(render(RemotePcTileControls,child.props,ui.scope).tree);assert.equal(button('Запрос отправлен — ждём владельца').props.disabled,true);
  Object.assign(model,{available:true,active:true,focused:true,pending:false});nodes=walk(render(RemotePcTileControls,child.props,ui.scope).tree);await button('Завершить управление').props.onClick();assert.equal(finishes,surface==='guest'?1:2);
  let editor=nodes.find(n=>n.type==='textarea');editor.props.onChange({target:{value:'Привет 中文 👋 é'}});nodes=walk(render(RemotePcTileControls,child.props,ui.scope).tree);editor=nodes.find(n=>n.type==='textarea');editor.props.onCompositionStart();const form=nodes.find(n=>n.type==='form');form.props.onSubmit({preventDefault(){}});await settle();assert.equal(texts.length,surface==='guest'?0:1,'composing draft is never sent');editor.props.onCompositionEnd();form.props.onSubmit({preventDefault(){}});form.props.onSubmit({preventDefault(){}});await settle();assert.equal(texts.at(-1),'Привет 中文 👋 é');assert.equal(texts.length,surface==='guest'?1:2,'explicit commit is sent exactly once');
  for(const language of ['en','zh-CN']){locale=language;nodes=walk(render(RemotePcTileControls,child.props,ui.scope).tree);assert.ok(nodes.some(n=>n.type==='textarea'));assert.ok(button(language==='en'?'Finish controlling':'结束控制'));}locale='ru';
 }
 console.log('PASS actual guest and staff screen surfaces: exact publication, Request/Pending/Finish clicks, deliberate Unicode/IME commit once, RU/EN/zh-CN');
})().catch(e=>{console.error(e);process.exitCode=1});
