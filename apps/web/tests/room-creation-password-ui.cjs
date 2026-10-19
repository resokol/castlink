const assert=require('node:assert/strict');
const {load}=require('./load-typescript.cjs');
let slots=[],cursor=0,effects=[],dirty=false,requests=[],pendingPost;let accessProps={allowed:true,configured:true,canInitialize:false};
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>v===b[i]);
const react={
 useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;dirty=true;}];},
 useRef(initial){const i=cursor++;return slots[i]??={current:initial};},
 useId(){const i=cursor++;return slots[i]??=`password-${i}`;},
 useEffect(callback,deps){const i=cursor++;if(!same(slots[i]?.deps,deps)){const old=slots[i];slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=callback();});}}
};
global.fetch=async(url,options={})=>{requests.push({url,options});if(options.method==='POST')return new Promise(resolve=>pendingPost=resolve);return{ok:true,json:async()=>({allowed:true,configured:true})};};
const {RoomCreationPasswordSettings,RoomCreationPasswordTab,useRoomCreationPasswordAccess}=load('../components/RoomCreationPasswordSettings.tsx',{react,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},'@/components/I18nProvider':{useI18n:()=>({t:text=>text})},'@/lib/i18n/management':{translateManagementMessage:(text)=>text}});
const nodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function render(){let tree,count=0;do{assert.ok(++count<10);dirty=false;cursor=0;effects=[];tree=RoomCreationPasswordSettings({studioId:'studio-default',roomName:'room-one',access:accessProps});while(effects.length)effects.shift()();}while(dirty);return tree;}
const input=(tree,name)=>nodes(tree).find(n=>n.type==='input'&&n.props.name===name);
const form=tree=>nodes(tree).find(n=>n.type==='form');
function fill(tree,name,value){input(tree,name).props.onChange({target:{value}});return render();}
(async()=>{
 render();await settle();let tree=render();
 assert.equal(tree.type,'section','password form belongs to a dedicated workspace section');
 assert.equal(tree.props.id,'studio-creation-password');
 assert.equal(nodes(tree).filter(n=>n.type==='input').length,3);
 for(const node of nodes(tree).filter(n=>n.type==='input'))assert.equal(node.props.type,'password');
 assert.equal(input(tree,'currentPassword').props.autoComplete,'current-password');
 assert.equal(input(tree,'newPassword').props.autoComplete,'new-password');
 tree=fill(tree,'currentPassword','current-secret');tree=fill(tree,'newPassword','new-secret-password');tree=fill(tree,'confirmation','mismatch-password');
 await form(tree).props.onSubmit({preventDefault(){}});tree=render();
 assert.equal(requests.filter(r=>r.options.method==='POST').length,0,'mismatched confirmation stays local');
 assert.ok(nodes(tree).some(n=>n.props.role==='alert'));
 tree=fill(tree,'confirmation','new-secret-password');
 const submit=form(tree).props.onSubmit;const first=submit({preventDefault(){}});submit({preventDefault(){}});tree=render();
 assert.equal(requests.filter(r=>r.options.method==='POST').length,1,'double clicks submit only once');
 assert.equal(input(tree,'newPassword').props.disabled,true);
 pendingPost({ok:true,json:async()=>({ok:true})});await first;tree=render();
 for(const name of ['currentPassword','newPassword','confirmation'])assert.equal(input(tree,name).props.value,'','successful change clears all secrets');
 assert.ok(nodes(tree).some(n=>n.props.role==='status'));
 tree=fill(tree,'currentPassword','do-not-retain');
 slots=[];tree=render();assert.equal(input(tree,'currentPassword').props.value,'','leaving and reopening the tab clears secrets');
 let opens=0;const tab=RoomCreationPasswordTab({access:{allowed:true,configured:true},active:false,onOpen:()=>opens++});assert.equal(tab.type,'button');assert.equal(tab.props['aria-controls'],'studio-creation-password');tab.props.onClick();assert.equal(opens,1);
 assert.equal(RoomCreationPasswordTab({access:{allowed:false},active:false,onOpen(){}}),null,'unauthorized roles have no tab');
 const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'../components/StudioWorkspace.tsx'),'utf8');
 assert.ok(source.indexOf('<RoomCreationPasswordTab')<source.indexOf('<button className="sidebar-leave-button"'),'password tab is directly before sidebar exit');
 slots=[];accessProps={allowed:true,configured:false,canInitialize:true};tree=render();assert.equal(nodes(tree).filter(n=>n.type==='input').length,2,'first setup has no current password field');
 assert.ok(nodes(tree).some(n=>n.type==='button'&&n.props.children==='Установить пароль'));
 slots=[];let pendingGet;global.fetch=()=>new Promise(resolve=>pendingGet=resolve);
 const hookRender=()=>{let value;do{dirty=false;cursor=0;effects=[];value=useRoomCreationPasswordAccess('studio-default','room-one');while(effects.length)effects.shift()();}while(dirty);return value;};
 let state=hookRender();state.markConfigured();state=hookRender();assert.equal(state.configured,true);
 pendingGet({ok:true,json:async()=>({allowed:true,configured:false,canInitialize:true})});await settle();state=hookRender();
 assert.equal(state.configured,true,'a delayed pre-setup response cannot undo a successful local setup');
 console.log('PASS password UI: dedicated tab placement, masked fields, confirmation, single submit, busy/success and secret clearing');
})().catch(e=>{console.error(e);process.exitCode=1;});
