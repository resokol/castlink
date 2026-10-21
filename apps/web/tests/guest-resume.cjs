const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),path=require('node:path');
const p=path.resolve(__dirname,'../lib/guest-resume.ts');assert.ok(fs.existsSync(p),'guest resume not implemented');const m=new Module(p,module);m.filename=p;m.paths=module.paths;m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,p);
const {requestGuestSession,guestResumeKey,guestResumeStorage,acceptGuestInvite}=m.exports;
(async()=>{
 const state=new Map(),storage={getItem:k=>state.get(k)||null,setItem:(k,v)=>state.set(k,v),removeItem:k=>state.delete(k)};let requests=[];
 const fetcher=async(url,init)=>{requests.push({url,init});return {ok:true,status:200,json:async()=>({token:'signed-session',identity:'guest-one'}),text:async()=>''};};
 await requestGuestSession({studioId:'s',room:'r',name:'A',storage,fetcher});
 await requestGuestSession({studioId:'s',room:'r',name:'A',storage,fetcher});
 assert.equal(requests[1].init.headers.authorization,'Bearer signed-session');assert.match(requests[1].url,/identity=guest-one/);
 await requestGuestSession({studioId:'s',room:'other',name:'A',storage,fetcher});assert.equal(requests[2].init.headers.authorization,undefined,'room isolation');
 let count=0;await requestGuestSession({studioId:'s',room:'r',name:'A',storage,fetcher:async(u,i)=>{count++;return count===1?{ok:false,status:401,text:async()=>''}:fetcher(u,i);}});assert.equal(count,2,'expired renewal falls back once');
 count=0;await assert.rejects(()=>requestGuestSession({studioId:'s',room:'r',name:'A',storage,fetcher:async()=>{count++;return {ok:false,status:409,text:async()=>JSON.stringify({error:'moved'})};}}));assert.equal(count,1,'moved/revoked no fresh-session bypass');
 requests=[];await requestGuestSession({studioId:'s',room:'r',name:'A',storage,fetcher,fresh:true});assert.equal(requests[0].init.headers.authorization,undefined,'server-transfer arrival never resumes a prior moved session');
 requests=[];await requestGuestSession({studioId:'s',room:'private',name:'A',storage,fetcher,personalInvite:'invite-one'});
 await requestGuestSession({studioId:'s',room:'private',name:'A',storage,fetcher,personalInvite:'invite-one'});
 assert.equal(requests[1].init.headers.authorization,'Bearer signed-session','same personal invitation resumes the signed session');
 await requestGuestSession({studioId:'s',room:'private',name:'A',storage,fetcher,personalInvite:'invite-two'});
 assert.equal(requests[2].init.headers.authorization,undefined,'a different personal invitation cannot inherit the prior session or defaults');
 assert.notEqual(guestResumeKey('a:b','c'),guestResumeKey('a','b:c'));
 // A reopened tab has empty session storage but retains the signed durable credential.
 const durable=new Map();let tab=new Map();
 const backed=values=>({getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)});
 global.localStorage=backed(durable);global.sessionStorage=backed(tab);
 requests=[];await requestGuestSession({studioId:'durable',room:'r',name:'A',storage:guestResumeStorage(),fetcher,personalInvite:'exact-invite',claim:async()=>true});
 const original=durable.get(guestResumeKey('durable','r'));assert.ok(original,'signed credential is saved beyond the tab lifetime');
 tab=new Map();global.sessionStorage=backed(tab);
 await requestGuestSession({studioId:'durable',room:'r',name:'A',storage:guestResumeStorage(),fetcher,personalInvite:'exact-invite',claim:async()=>true});
 assert.equal(requests[1].init.headers.authorization,'Bearer signed-session','closed/reopened tab resumes its signed identity');
 // Another tab cannot claim the active identity or overwrite its durable credential.
 tab=new Map();global.sessionStorage=backed(tab);let blockedRequest;
 const other=async(url,init)=>{blockedRequest=init;return {ok:true,status:200,json:async()=>({token:'other-session',identity:'guest-other'})};};
 await requestGuestSession({studioId:'durable',room:'r',name:'A',storage:guestResumeStorage(),fetcher:other,personalInvite:'exact-invite',claim:async identity=>identity!=='guest-one'});
 assert.equal(blockedRequest.headers.authorization,undefined,'a held identity never appears in another tab renewal');
 assert.equal(durable.get(guestResumeKey('durable','r')),original,'another tab preserves the assigned caster durable credential');
 await requestGuestSession({studioId:'durable',room:'r',name:'A',storage:guestResumeStorage(),fetcher:other,personalInvite:'exact-invite',claim:async()=>true});
 assert.equal(durable.get(guestResumeKey('durable','r')),original,'refreshing the second tab keeps its identity tab-local');
 const secondary=tab.get(guestResumeKey('durable','r'));
 guestResumeStorage().removeItem(guestResumeKey('durable','r'));
 assert.equal(tab.has(guestResumeKey('durable','r')),false,'secondary kick/staff transition clears its own tab credential');
 assert.equal(durable.get(guestResumeKey('durable','r')),original,'secondary cleanup preserves a different durable identity');
 tab.set(guestResumeKey('durable','r'),secondary);let expiredAttempts=0;
 await requestGuestSession({studioId:'durable',room:'r',name:'A',storage:guestResumeStorage(),claim:async()=>true,fetcher:async(url,init)=>{expiredAttempts++;return expiredAttempts===1?{ok:false,status:401}:other(url,init);}});
 assert.equal(expiredAttempts,2);assert.equal(durable.get(guestResumeKey('durable','r')),original,'secondary token expiry cannot erase the primary durable identity');
 // An explicitly different accepted invite still intentionally replaces both bindings.
 acceptGuestInvite(guestResumeStorage(),'durable','r','different-invite');
 assert.equal(JSON.parse(durable.get(guestResumeKey('durable','r'))).entryInvite,'different-invite');
 tab.set(guestResumeKey('durable','r'),original);durable.set(guestResumeKey('durable','r'),original);
 guestResumeStorage().removeItem(guestResumeKey('durable','r'));
 assert.equal(durable.has(guestResumeKey('durable','r')),false);assert.equal(tab.has(guestResumeKey('durable','r')),false,'matching primary cleanup clears both restore stores');
 durable.set(guestResumeKey('durable','r'),original);
 guestResumeStorage().removeItem(guestResumeKey('durable','r'));
 assert.equal(durable.has(guestResumeKey('durable','r')),false,'cleanup without a tab credential clears the selected durable fallback');
 // Blocked browser storage still permits the original per-tab path.
 Object.defineProperty(global,'localStorage',{configurable:true,get(){throw Error('blocked');}});
 await requestGuestSession({studioId:'fallback',room:'r',name:'A',storage:guestResumeStorage(),fetcher});
 assert.ok(tab.get(guestResumeKey('fallback','r')),'session storage remains available when durable storage is blocked');
 console.log('PASS: authenticated scoped resume, invitation binding, durable reopen, duplicate-tab isolation, expiry/revocation and storage fallback');
})().catch(e=>{console.error(e);process.exitCode=1;});
