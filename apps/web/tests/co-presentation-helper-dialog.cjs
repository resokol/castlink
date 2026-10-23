// The browser controls must never open the retired client pairing/install dialog.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const text=fs.readFileSync(require.resolve('../components/CoPresentationPanel.tsx'),'utf8');
const source=ts.createSourceFile('panel.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),nodes={};
(function visit(node){if(ts.isVariableDeclaration(node)&&['getNativeBridge','preparePptx'].includes(node.name.getText(source)))nodes[node.name.getText(source)]=node.initializer;ts.forEachChild(node,visit)})(source);
const calls=[],scope={window:{},powerPointBridge:()=>undefined,requestedKind:{current:undefined},connected:true,nativeBusy:false,busy:false,screenSharing:false,nativeText:{helperRequired:'Presenter client required; caster uses browser'},setError:value=>calls.push(value)};
const run=name=>vm.runInNewContext(ts.transpileModule('('+nodes[name].getText(source)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,scope);
scope.getNativeBridge=run('getNativeBridge');assert.equal(scope.getNativeBridge(),undefined);
(async()=>{await run('preparePptx')();assert.deepEqual(calls,['Presenter client required; caster uses browser']);assert.doesNotMatch(text,/PRESENTER_INSTALLER_URL|helperDialog|helperPair/,'browser controls have no pairing/install modal; native setup is owner capture only');console.log('PASS browser has no helper pairing/install dialog; recipient needs no manual Connect and prepared native action explains capability');})().catch(error=>{console.error(error);process.exitCode=1});
