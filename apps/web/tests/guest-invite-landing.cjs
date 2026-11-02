'use strict';
const assert = require('node:assert/strict');
const {load} = require('./load-typescript.cjs');
const {translate} = load('../lib/i18n.ts');
const mac = {userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15',platform:'MacIntel',maxTouchPoints:0};
const windows = {userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0',platform:'Win32',maxTouchPoints:0};
const ipad = {...mac,maxTouchPoints:5};
const settle = () => new Promise(resolve => setImmediate(resolve));
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node,...nodes(node.props?.children)];

function fixture({browser=mac,href='https://studio.example/join#invite=opaque',embedded=false,locale='en'}={}) {
  let cursor=0, pending=[], hookState=[];
  const react={
    useState(initial) {const index=cursor++;if(!(index in hookState))hookState[index]=initial;return[hookState[index],value=>{hookState[index]=typeof value==='function'?value(hookState[index]):value;}];},
    useRef(initial) {const index=cursor++;if(!(index in hookState))hookState[index]={current:initial};return hookState[index];},
    useEffect(effect,deps) {const index=cursor++;const old=hookState[index];if(!old||deps.some((value,i)=>value!==old.deps[i]))pending.push(()=>{old?.cleanup?.();hookState[index]={deps,cleanup:effect()};});},
  };
  const frames=[], requests=[], entered=[];
  let respond;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:browser});
  global.window={location:Object.freeze({origin:'https://studio.example',assign(){assert.fail('invitation must retain browser page');}}),castlinkDesktop:embedded?{}:undefined,setTimeout:()=>1};
  global.document={visibilityState:'visible',createElement(tag){assert.equal(tag,'iframe');return{setAttribute(){},remove(){this.removed=true;}};},body:{appendChild(frame){frames.push(frame);}},addEventListener(){},removeEventListener(){}};
  global.fetch=(url,options)=>{requests.push({url,options});return new Promise(resolve=>{respond=resolve;});};
  const {GuestInviteLanding}=load('../components/GuestInviteLanding.tsx',{
    react,
    'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'fragment'},
    './I18nProvider':{useI18n:()=>({t:source=>translate(locale,source)})},
    './EntryShell':{EntryShell:()=>null,EntryIcon:()=>null},
  });
  function render(){cursor=0;const tree=GuestInviteLanding({href,onContinue:(...args)=>entered.push(args),onBack(){}});while(pending.length)pending.shift()();return tree;}
  return {frames,requests,entered,render,
    async resolve({ok=true,status=200,data={room:'Studio',entrySettings:{startMuted:true}}}={}) {respond({ok,status,json:async()=>data});await settle();render();return render();},
    dispose(){for(const hook of hookState)hook?.cleanup?.();},
  };
}

(async()=>{
  for(const browser of [mac,windows]) {
    const h=fixture({browser});
    try {
      h.render();
      assert.equal(h.frames.length,0,'protocol launch waits for server validation');
      assert.equal(h.requests.length,1);
      let tree=await h.resolve();
      assert.equal(h.frames.length,1,'supported desktop makes one automatic handoff');
      assert.equal(h.frames[0].hidden,true);
      const target=new URL(h.frames[0].src);
      assert.equal(target.protocol,'castlink:');
      assert.equal(target.searchParams.get('url'),'https://studio.example/join#invite=opaque');
      h.render();h.render();
      assert.equal(h.frames.length,1,'rerenders cannot repeat automatic opening');
      assert.equal(h.entered.length,0,'opening native app does not enter browser session');
      const download=nodes(tree).find(node=>node.type==='a');
      assert.equal(download.props.children,browser===mac?'Download for macOS':'Download for Windows');
      assert.equal(download.props.rel,'noopener noreferrer');
      const continueButton=nodes(tree).find(node=>node.type==='button'&&node.props.children==='Continue in browser');
      continueButton.props.onClick();
      assert.equal(h.entered.length,1,'browser fallback remains actionable');
      assert.equal(h.entered[0][0],'Studio');
      assert.equal(h.entered[0][1].startMuted,true,'server entry settings preserved');
      const reopen=nodes(tree).find(node=>node.type==='button'&&node.props.children==='Open in the CastLink app');
      reopen.props.onClick();
      assert.equal(h.frames.length,2,'explicit retry is available');
      assert.equal(h.frames[0].removed,true,'retry removes previous isolated frame');
    } finally {h.dispose();}
  }
  for(const browser of [ipad,{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',platform:'iPhone',maxTouchPoints:5},{userAgent:'Mozilla/5.0 (X11; Linux x86_64)',platform:'Linux x86_64'}]) {
    const h=fixture({browser});
    try {h.render();const tree=await h.resolve();assert.equal(h.frames.length,0,'mobile/unsupported browser never autoopens desktop app');assert.equal(nodes(tree).find(node=>node.type==='a').props.children,'Download CastLink');}
    finally {h.dispose();}
  }
  for(const locale of ['ru','zh-CN']) {
    const h=fixture({locale});
    try {h.render();const tree=await h.resolve();assert.equal(nodes(tree).find(node=>node.type==='a').props.children,locale==='ru'?'Скачать для macOS':'下载 macOS 版');}
    finally {h.dispose();}
  }
  const embedded=fixture({embedded:true});
  try {embedded.render();await embedded.resolve();assert.equal(embedded.frames.length,0,'native client cannot launch another native client');assert.equal(embedded.entered.length,1,'validated embedded invite continues directly');}
  finally {embedded.dispose();}
  for(const href of ['javascript:alert(1)','https://another.example/join#invite=opaque']) {
    const h=fixture({href});
    try {h.render();h.render();assert.equal(h.requests.length,0,'invalid/cross-origin invites are rejected before validation');assert.equal(h.frames.length,0);}
    finally {h.dispose();}
  }
  const denied=fixture();
  try {denied.render();const tree=await denied.resolve({ok:false,status:403});assert.equal(denied.frames.length,0,'server-rejected invite cannot launch app');assert.ok(nodes(tree).some(node=>node.type==='h1'&&node.props.children==='Invitation is invalid'));}
  finally {denied.dispose();}
  console.log('PASS invitation landing: validated one-shot Windows/macOS iframe handoff, iPad/mobile exclusion, browser fallback/retry, platform download labels and native-loop prevention');
})().catch(error=>{console.error(error);process.exitCode=1;});
