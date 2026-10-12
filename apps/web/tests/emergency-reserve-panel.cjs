require('./i18n-fixture.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');

const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../components/EmergencyReservePanel.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const fixtureModule={exports:{}};
vm.runInNewContext(code,{module:fixtureModule,exports:fixtureModule.exports,require:name=>name==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}:name==='@/lib/use-session-transfer'?{reserveStatusText:()=>'',reserveAutomaticStatusText:()=>''}:require(name),Date:class extends Date{static now(){return 1700000600000;}}});
function button(view){const tree=fixtureModule.exports.EmergencyReservePanel({view,targets:[],onSelect:()=>{},onActivate:()=>{}});const find=node=>Array.isArray(node)?node.map(find).find(Boolean):node&&typeof node==='object'?node.type==='button'?node:find(node.props?.children):undefined;return find(tree);}
const prepared={peerId:'peer',targetId:'target',label:'Reserve',targetUrl:'https://reserve.example',cohortId:'cohort',armGeneration:1,revision:1,snapshotAt:1700000000000,readyUntil:1700000300000,grant:'grant',role:'studio'};

test('activation button follows verified client phase despite a browser clock ahead of the reserve',()=>{
 for(const phase of ['ready','unreachable'])assert.equal(button({phase,prepared,busy:false}).props.disabled,false,phase);
 for(const view of [{phase:'stale',prepared,busy:false},{phase:'ready',prepared,busy:true},{phase:'committed',prepared,busy:false},{phase:'unprepared',prepared,busy:false},{phase:'ready',busy:false}])assert.equal(button(view).props.disabled,true,view.phase);
});

function checkbox(view,onAutomatic=()=>{}){
 const tree=fixtureModule.exports.EmergencyReservePanel({view,targets:[],onSelect:()=>{},onActivate:()=>{},onAutomatic});
 const find=node=>Array.isArray(node)?node.map(find).find(Boolean):node&&typeof node==='object'?node.type==='input'&&node.props.type==='checkbox'?node:find(node.props?.children):undefined;
 return find(tree);
}
test('automatic switch is default OFF, requires capability and displays requested disable without claiming acknowledgement',()=>{
 const ready={phase:'ready',busy:false,prepared:{...prepared,autoSupported:true,autoEnabled:true,autoEpoch:1}};
 let requested;const control=checkbox(ready,value=>requested=value);assert.ok(control);assert.equal(control.props.checked,true);assert.equal(control.props.disabled,false);control.props.onChange({target:{checked:false}});assert.equal(requested,false);
 assert.equal(checkbox({...ready,prepared:{...ready.prepared,autoEnabled:undefined}}).props.checked,false);
 assert.equal(checkbox({...ready,prepared:{...ready.prepared,autoSupported:undefined}}).props.disabled,true);
 assert.equal(checkbox({...ready,autoPending:false,autoUnconfirmed:true}).props.checked,false);
 assert.equal(checkbox({...ready,phase:'stale'}).props.disabled,true);
});
