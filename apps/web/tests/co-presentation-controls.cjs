const assert=require('node:assert/strict');
const {load}=require('./load-typescript.cjs');
const sharedPip=load('../lib/document-picture-in-picture.ts');
const {createScreenShareStopPanel}=load('../lib/screen-share-stop-panel.ts',{'./document-picture-in-picture':sharedPip});
const {createCoPresentationControls,slideControlsId,slideControlsText,slidesBridge,validSlideControlsState}=load('../lib/co-presentation-controls.ts',{'./document-picture-in-picture':sharedPip});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const session={id:'server-id',generation:'generation-one',controlRevision:2};
const initial={id:slideControlsId(session),title:'Slides <img src=x>',controller:'Caster',page:2,pages:4,canNavigate:true,canReclaim:false,busy:false,locale:'en'};
class Element extends EventTarget {
 constructor(tag,doc){super();this.tagName=tag;this.ownerDocument=doc;this.children=[];this.style={};this.attributes={};this.textContent='';this.classList={add:()=>{}};}
 get lastElementChild(){return this.children.at(-1);}
 append(...children){for(const node of children){node.remove();node.parentElement=this;this.children.push(node);}}
 setAttribute(name,value){this.attributes[name]=value;} getAttribute(name){return this.attributes[name];}
 remove(){if(this.parentElement){const nodes=this.parentElement.children;nodes.splice(nodes.indexOf(this),1);this.parentElement=undefined;}}
 contains(node){return node===this||this.children.some(child=>child.contains(node));}
 getBoundingClientRect(){return{top:0,bottom:100,height:100};}
 focus(){this.ownerDocument.activeElement=this;} scrollIntoView(){this.scrolled=true;}
 click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
}
class Document extends EventTarget {constructor(){super();this.title='';this.documentElement=new Element('html',this);this.head=new Element('head',this);this.body=new Element('body',this);}createElement(tag){return new Element(tag,this);}createElementNS(_,tag){return this.createElement(tag);}}
class Popup extends EventTarget{constructor(){super();this.closed=false;this.document=new Document();this.screen={availHeight:800};this.innerHeight=440;this.outerHeight=440;this.outerWidth=390;}resizeTo(width,height){this.outerWidth=width;this.outerHeight=this.innerHeight=height;}close(){this.closed=true;this.dispatchEvent(new Event('pagehide'));}focus(){this.focused=true;}}
const find=(node,predicate)=>predicate(node)?node:node.children.map(child=>find(child,predicate)).find(Boolean);
const control=(popup,action)=>find(popup.document.body,node=>node.getAttribute('data-action')===action&&!node.hidden);
(async()=>{
 assert.equal(slideControlsText('X'.repeat(200),'fallback').length,120);assert.equal(slideControlsText('\n\u007f','fallback'),'fallback');assert.equal(validSlideControlsState({...initial,controller:'bad\nname'}),false);
 assert.equal(slidesBridge({}),undefined);assert.ok(validSlideControlsState(initial));assert.equal(validSlideControlsState({...initial,url:'https://invalid'}),false);assert.equal(validSlideControlsState({...initial,page:0}),false);
 const calls=[],actions=[];let visible=false,listener,removed=0;
 const bridge={async update(state){calls.push(['update',state]);return{visible};},async show(state){calls.push(['show',state]);visible=true;return{visible};},async hide(id){calls.push(['hide',id]);visible=false;},onAction(callback){listener=callback;return()=>removed++;}};
 assert.equal(slidesBridge({castlinkDesktop:{version:1,slides:bridge}}),bridge);
 const adapter=createCoPresentationControls({host:{},bridge,action:action=>actions.push(action)});
 await adapter.update(initial);assert.equal(calls.some(call=>call[0]==='show'),false,'updates do not open controls');
 assert.equal(await adapter.show(),true);listener({id:initial.id,action:'next'});listener({id:initial.id,action:'next'});await settle();assert.equal(actions.length,1,'one action while callback in flight');
 visible=false;await adapter.update({...initial,page:3});assert.equal(calls.filter(call=>call[0]==='show').length,1,'hidden native controls stay hidden on state refresh');
 const replacement={...initial,id:slideControlsId({...session,controlRevision:3}),canNavigate:false,canReclaim:true};
 await adapter.update(replacement);assert.equal(calls.at(-2)[0],'hide');assert.equal(calls.at(-2)[1],initial.id);listener({id:initial.id,action:'next'});listener({id:replacement.id,action:'next'});await settle();assert.equal(actions.length,1,'old id and delegated owner navigation rejected');
 listener({id:replacement.id,action:'reclaim'});await settle();assert.equal(actions.at(-1).action,'reclaim');
 await adapter.update({...replacement,busy:true});listener({id:replacement.id,action:'reclaim'});await settle();assert.equal(actions.length,2,'busy disables actions');
 await adapter.update(initial);listener({id:initial.id,action:'next'});adapter.clear();await settle();assert.equal(actions.length,2,'clear invalidates queued same-id action with local epoch');
 await adapter.update(initial);adapter.dispose();await settle();assert.equal(removed,1);assert.equal(await adapter.show(),false);listener({id:initial.id,action:'next'});await settle();assert.equal(actions.length,2);
 const windows=[],browserActions=[],openCalls=[];
 const host={documentPictureInPicture:{requestWindow(size){openCalls.push(size);const popup=new Popup();windows.push(popup);return Promise.resolve(popup);}},open(){assert.fail('DocumentPiP never falls back to an ordinary popup');}};
 const browser=createCoPresentationControls({host,action:action=>browserActions.push(action)});
 await browser.update(initial);assert.equal(windows.length,0);await browser.show();const popup=windows[0];assert.deepEqual(openCalls[0],{width:420,height:250});assert.equal(browser.native,false);assert.equal(browser.browserFloating,true);assert.equal(find(popup.document.body,node=>node.tagName==='strong').textContent,initial.title,'title uses textContent');assert.equal(popup.document.title,initial.title);assert.equal(popup.document.documentElement.lang,'en');
 const next=control(popup,'next');next.click();await settle();assert.equal(browserActions[0].action,'next');
 await browser.update(replacement);next.click();await settle();assert.equal(browserActions.length,1,'retained old DOM button cannot affect new session');
 control(popup,'reclaim').click();await settle();assert.equal(browserActions.at(-1).action,'reclaim');
 popup.close();await browser.update({...replacement,page:3});assert.equal(windows.length,1,'closing browser popup only hides; update does not reopen');assert.equal(browserActions.length,2);
 await browser.show();assert.equal(windows.length,2);assert.ok(find(windows[1].document.body,node=>node.getAttribute('data-slide-toolbar')!==undefined),'OS close/reopen renders the actual toolbar in the new document');control(windows[1],'reclaim').click();await settle();assert.equal(browserActions.length,3,'new document controls route the current grant');browser.clear();assert.equal(windows[1].closed,true);assert.equal(browserActions.length,3,'cleanup never issues presentation or media commands');browser.dispose();
 const pollingWindows=[];const polling=createCoPresentationControls({host:{documentPictureInPicture:{requestWindow(){const child=new Popup();pollingWindows.push(child);return Promise.resolve(child);}}},action:()=>{}});
 const many={...initial,toolbar:{canDelegate:true,canStop:true,sharing:true,controllerIdentity:null,participants:Array.from({length:100},(_,index)=>({identity:'caster-'+index,name:'A long caster name '+index}))}};
 await polling.update(many);await polling.show();const live=pollingWindows[0],root=live.document.body.children[0],trigger=control(live,'menu');trigger.click();const focused=live.document.activeElement;assert.equal(trigger.getAttribute('aria-expanded'),'true');assert.equal(focused.scrolled,true,'keyboard menu focus is brought into the bounded candidate list');await polling.update({...many,title:'Updated title',page:3});assert.equal(live.document.body.children[0],root,'same grant polling patches stable DOM');assert.equal(live.document.activeElement,focused,'polling preserves menu keyboard focus');assert.equal(trigger.getAttribute('aria-expanded'),'true','polling preserves the open menu');polling.dispose();
 // Actual independent STOP controller and slides share the same browser window.
 let media=true,stopCalls=0,sharedRequests=0;
 const sharedWindow=new Popup(),api={requestWindow(){sharedRequests++;return Promise.resolve(sharedWindow);}};
 const stopPanel=createScreenShareStopPanel({api,labels:{locale:'en',title:'Stop',stop:'STOP',stopping:'Stopping',stopError:'Retry'},isSharing:()=>media,stop:async()=>{stopCalls++;media=false;}});
 const sharedSlides=createCoPresentationControls({host:{documentPictureInPicture:api},action:()=>{}});
 await stopPanel.open();const stopButton=find(sharedWindow.document.body,node=>node.tagName==='button');
 await sharedSlides.update(initial);await sharedSlides.show();assert.equal(sharedRequests,1,'STOP-first shares actual window with slide renderer');
 assert.equal(sharedWindow.document.body.children.length,2);sharedSlides.clear();assert.equal(sharedWindow.closed,false);assert.equal(stopCalls,0,'slide cleanup preserves media and independent STOP');
 await sharedSlides.update(initial);await sharedSlides.show();stopButton.click();await settle();assert.equal(stopCalls,1);assert.equal(sharedWindow.closed,false,'successful media STOP preserves live slide controls');assert.equal(sharedWindow.document.body.children.length,1);
 stopPanel.dispose();sharedSlides.dispose();assert.equal(sharedWindow.closed,true);stopButton.click();await settle();assert.equal(stopCalls,1,'detached old STOP DOM cannot issue actions');
 // A request for an old grant cannot orphan a window or close a newer explicit show.
 let release;const raceWindows=[];
 const racing=createCoPresentationControls({host:{documentPictureInPicture:{requestWindow(){return new Promise(r=>release=()=>{const win=new Popup();raceWindows.push(win);r(win);});}}},action:()=>assert.fail()});
 await racing.update(initial);const oldShow=racing.show();await racing.update(replacement);const newShow=racing.show();release();assert.equal(await oldShow,false);assert.equal(await newShow,true);assert.equal(raceWindows[0].closed,false);
 racing.clear();await racing.update(initial);const staleShow=racing.show();await racing.update(replacement);release();assert.equal(await staleShow,false);assert.equal(raceWindows.at(-1).closed,true,'stale pending result without a new explicit show is closed');
 racing.dispose();
 const blocked=createCoPresentationControls({host:{screen:{availWidth:900,availHeight:900},open:()=>null},action:()=>assert.fail()});await blocked.update(initial);assert.equal(await blocked.show(),false,'unsupported browser keeps inline controls');blocked.dispose();
 console.log('PASS floating slides native/browser contract, hidden-window persistence, exact grant id/local epoch, delegate/reclaim/busy gating, safe DOM, popup bounds and lifecycle cleanup');
})().catch(error=>{console.error(error);process.exitCode=1;});
