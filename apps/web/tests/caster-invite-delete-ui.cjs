const assert=require('node:assert/strict'),React=require('react'),{load}=require('./load-typescript.cjs');
const standalone={id:'standalone-invite',path:'/join#invite=synthetic'},bound={id:'bound-invite',path:'/join#invite=synthetic-bound'};
let busy=false;
const data={slots:[{id:'slot',inviteId:bound.id}],invites:[standalone,bound],queue:[]};
const state=initial=>[initial&&typeof initial==='object'&&'slots'in initial?data:initial===false?busy:initial,()=>{}];
const {CasterSlotsPanel}=load('../components/CasterSlotsPanel.tsx',{
 react:{...React,useState:state,useEffect:()=>{},useRef:value=>({current:value})},
 './I18nProvider':{useI18n:()=>({t:x=>x})},
});
const nodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
const props={studioId:'studio-default',roomName:'A'};
global.window={location:{origin:'https://local.example'},confirm:()=>false};
const requests=[];let finish;
global.fetch=(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return new Promise(resolve=>{finish=()=>resolve({ok:true,json:async()=>({...data,invites:[bound]})});});};
(async()=>{
 const tree=CasterSlotsPanel(props),remove=nodes(tree).filter(n=>n.type==='button'&&n.props.children==='Удалить');
 assert.equal(remove.length,1,'only standalone invitations expose deletion');
 remove[0].props.onClick();assert.equal(requests.length,0,'cancel leaves the invitation active');
 window.confirm=()=>true;remove[0].props.onClick();remove[0].props.onClick();
 assert.equal(requests.length,1,'busy mutation cannot be submitted twice');
 assert.equal(requests[0].url,'/api/caster-slots');assert.deepEqual(requests[0].body,{studioId:'studio-default',room:'A',action:'delete-invite',id:standalone.id});
 finish();await new Promise(resolve=>setImmediate(resolve));
 busy=true;assert.equal(nodes(CasterSlotsPanel(props)).find(n=>n.type==='button'&&n.props.children==='Удалить').props.disabled,true);
 console.log('PASS invitation delete UI: standalone only, cancel, scoped request, duplicate guard and busy state');
})().catch(error=>{console.error(error);process.exitCode=1;});
