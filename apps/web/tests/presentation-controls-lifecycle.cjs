const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const file=ts.createSourceFile('PresentationControls.tsx',fs.readFileSync(`${__dirname}/../components/PresentationControls.tsx`,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let start,disconnect;
(function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(file)==='startPdf')start=n.initializer;if(ts.isCallExpression(n)&&n.expression.getText(file)==='useEffect'&&n.arguments[0].getText(file).includes('if (!connected)'))disconnect=n.arguments[0];ts.forEachChild(n,visit);})(file);
const expression=(n,context)=>vm.runInNewContext(ts.transpileModule(`(${n.getText(file)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
const deferred=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)}};
async function late(stage){
 const held=deferred(),calls=[];let bridges=0;
 const context={perform:run=>run(),pdfStatus:{current:{ready:true}},generation:{current:0},ownedId:{current:''},mounted:{current:true},active:{current:undefined},connected:false,token:'owner',studioId:'studio',roomName:'room',stopLocalBridge(){},setSessions(){},setPair(){},setError(){},crypto:{randomUUID:()=>crypto.randomUUID()},body:(action,extra)=>({action,...extra}),presentationRequest:async(token,body)=>{calls.push(body.action);if(body.action===stage)return held.promise;if(body.action==='pair')return{sessionId:'session',pairToken:'pair'};return{};},createPdfPresentationBridge(){bridges++;throw Error('must not connect after disconnect');}};
 const run=expression(start,context);const disconnectNow=expression(disconnect,context);
 const pending=run();await new Promise(r=>setImmediate(r));disconnectNow();held.resolve(stage==='pair'?{sessionId:'session',pairToken:'pair'}:{sessionToken:'capability'});await pending;
 assert.equal(bridges,0,`late ${stage} response cannot resume PDF control`);assert.equal(context.ownedId.current,'');assert.ok(calls.includes('revoke'),'late session is revoked');if(stage==='pair')assert.ok(!calls.includes('connect'));
}
(async()=>{await late('pair');await late('connect');console.log('PASS actual PDF start lifecycle: disconnect invalidates late pair/connect and revokes capability without auto reconnect');})().catch(e=>{console.error(e);process.exitCode=1;});
