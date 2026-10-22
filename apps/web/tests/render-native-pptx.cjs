const fs=require('fs'),path=require('path'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{load}=require('./load-typescript.cjs');
const source=ts.createSourceFile('panel.tsx',fs.readFileSync(path.resolve(__dirname,'../components/CoPresentationPanel.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),names=[];
(function visit(n){if(ts.isVariableDeclaration(n)&&ts.isArrayBindingPattern(n.name)&&n.initializer&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(source)==='useState')names.push(n.name.elements[0].getText(source));ts.forEachChild(n,visit)})(source);
const room={state:'connected',localParticipant:{identity:'owner',sid:'SID-owner',getTrackPublication:()=>undefined},remoteParticipants:new Map()};
const session={id:'example',generation:'grant',revision:1,controlRevision:1,kind:'powerpoint',navigationMode:'powerpoint-steps-v1',name:'Презентация проекта.pptx',owner:{identity:'owner',sid:'SID-owner'},controller:{identity:'anna',sid:'SID-anna'},page:4,pages:18,renderedPage:4,renderedRevision:1};
const out=path.resolve(__dirname,'../../../backups/native-pptx-test/renders');fs.mkdirSync(out,{recursive:true});
for(const mode of ['empty','prepared','ready','delegated']){
let i=0;const state={connected:true,prepared:mode==='empty'?undefined:{preparedId:'opaque',name:session.name},capturePending:mode==='ready',native:mode==='delegated'||mode==='ready'?{id:'opaque',name:session.name,page:4,pages:18}:undefined,own:mode==='delegated'||mode==='ready'?session:undefined,sessions:mode==='delegated'||mode==='ready'?[session]:[],casters:[{identity:'owner',name:'Вы'},{identity:'anna',name:'Анна Смирнова'},{identity:'mikhail',name:'Михаил Петров'}],screenSharing:mode==='delegated',browserControlsReady:true,menuOpen:mode==='delegated'};
const overrides={react:{...React,useState:initial=>{const key=names[i++];return[Object.hasOwn(state,key)?state[key]:typeof initial==='function'?initial():initial,()=>{}]},useEffect:()=>{},useRef:value=>({current:value}),useId:()=>':preview:'},'./I18nProvider':{useI18n:()=>({locale:'ru',t:x=>x})},'./RecipientSlideControls':{recipientSlideSessions:()=>[],RecipientSlideControls:()=>null},'./PdfPresentationViewer':{PdfPresentationViewer:()=>null}};
const {CoPresentationPanel}=load('../components/CoPresentationPanel.tsx',overrides);
const body=renderToStaticMarkup(React.createElement(CoPresentationPanel,{room,token:'preview',studioId:'preview',roomName:'preview'}));
fs.writeFileSync(path.join(out,mode+'.fragment.html'),body);
}
console.log('SNAPSHOTS',out,names.length);
