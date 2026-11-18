const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {load}=require('./load-typescript.cjs');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-video-history-'));
process.env.STUDIOLINK_STATS_DIR=directory;
process.env.LIVEKIT_API_KEY='test-key';process.env.LIVEKIT_API_SECRET='test-secret';
const store=load('../lib/telemetry-store.ts');
const {localNodeHistory}=load('../lib/node-history.ts');
const at=Date.now()-10000,room='media-tenant-one-CS';
const video={id:'in:video',participant:'studio-panel-main',name:'Студия 🐻',kind:'video',direction:'in',codec:'video/AV1',fps:60,freezes:4};
const sample=(session,i=0)=>({at:at+i,clientAt:at+i-100,room,identity:'guest-one',name:'Кастер 🐻',session,role:'guest',state:'connected',quality:'good',reconnects:0,uptimeSec:10,
 streams:[{...video},{id:'audio',kind:'audio',direction:'in'}],runtime:{token:'should-not-export'},audioPlayback:{enabled:true}});
let owner=true,admin=false;
let claims={sub:'guest-one',video:{room},metadata:JSON.stringify({studioId:'tenant-one',roomDisplayName:'CS'})};
class NextResponse extends Response{static json(body,init){return new Response(JSON.stringify(body),init);}}
class TokenVerifier{async verify(token){if(token!=='valid')throw Error('invalid');return claims;}}
const api=load('../app/api/stats/route.ts',{'next/server':{NextResponse},'livekit-server-sdk':{TokenVerifier},
 '@/lib/telemetry-store':store,'@/lib/access':{sameOrigin:()=>true},
 '@/lib/room-admin':{isRoomAdmin:async(_,r,s)=>admin&&r==='CS'&&s==='tenant-one'},
 '@/lib/room-studio-access':{canHostNamedRoom:async(_,r,s)=>owner&&r==='CS'&&s==='tenant-one'},
 '../../../lib/studio-scope':{defaultStudioId:()=> 'tenant-one',validateStudioId:s=>s,mediaRoomName:(s,r)=>`media-${s}-${r}`}});
const get=(query='')=>{const url=new URL('https://test/api/stats?diagnostics=video&room=CS&studioId=tenant-one');
 for(const [key,value] of new URLSearchParams(query))url.searchParams.set(key,value);
 return api.GET({nextUrl:url,headers:new Headers({authorization:'Bearer valid'})});};
const post=raw=>api.POST({headers:new Headers({authorization:'Bearer valid'}),text:async()=>JSON.stringify(raw)});
(async()=>{try{
 assert.equal(typeof store.readVideoHistory,'function','video history must expose exact stored samples');
 await store.saveSample({...sample('foreign-room'),room:'media-tenant-one-Other'});
 await store.saveSample({...sample('foreign-tenant'),room:'media-tenant-two-CS'});
 await store.saveSample({...sample('audio-only'),streams:[{kind:'audio',direction:'in'}]});
 for(let i=0;i<5;i++)await store.saveSample(sample('selected-session',i));
 await store.saveSample({...sample('studio-session',5),identity:'studio-panel-main',role:'studio',streams:[{...video,direction:'out'}]});
 const all=[],to=Date.now();let cursor;
 do{const page=await store.readVideoHistory(room,15,{limit:2,cursor,to});
  assert.equal(page.to,to);assert.equal(page.summary,undefined);
  assert.ok(page.samples.every(s=>s.streams.length===1&&s.streams[0].kind==='video'));
  assert.ok(page.samples.every(s=>s.runtime===undefined&&s.audioPlayback===undefined));
  all.push(...page.samples);cursor=page.nextCursor||undefined;
 }while(cursor);
 assert.deepEqual(all.map(s=>s.at),Array.from({length:6},(_,i)=>at+i));
 assert.equal(all[0].clientAt,at-100);assert.equal(all[0].streams[0].video,undefined,'legacy metrics stay available without invented counters');
 assert.equal((await store.readVideoHistory(room,15,{identity:'guest-one',role:'guest',session:'selected-session'})).samples.length,5);
 assert.equal((await store.readVideoHistory(room,15,{identity:'missing'})).samples.length,0);
 const relay=await localNodeHistory(new URLSearchParams({room,diagnostics:'video',limit:'2',to:String(to)}));
 assert.equal(relay.samples.length,2);assert.ok(relay.nextCursor);
 for(const options of [{limit:0},{limit:2001},{limit:1.5},{cursor:'../secret'},{to:NaN}])await assert.rejects(store.readVideoHistory(room,15,options),/invalid_(video|audio)_/);
 await assert.rejects(store.readVideoHistory(room,5),/invalid_video_period/);
 owner=false;assert.equal((await get()).status,403,'media JWT alone cannot read history');
 admin=true;assert.equal((await get()).status,200);admin=false;owner=true;
 assert.equal((await get('room=Other')).status,403);assert.equal((await get('studioId=tenant-two')).status,403);
 for(const query of ['limit=2001','cursor=invalid','to=NaN','session=bad','role=superhero','minutes=5'])assert.equal((await get(query)).status,400,query);
 const page=await(await get('session=selected-session&limit=2')).json();assert.equal(page.samples.length,2);assert.ok(page.nextCursor);
 const body={...sample('ingest-video-session'),at:12345,videoDiagnosticsLimited:true,streams:[{...video,video:{framesDecoded:120,framesDropped:-1,totalDecodeTime:0.5,trackSid:'TR_live',token:'secret',sdp:'secret',localAddress:'secret'}}]};
 assert.equal((await post(body)).status,204);
 const stored=(await store.readVideoHistory(room,15,{session:body.session})).samples[0];
 assert.equal(stored.clientAt,12345);assert.equal(stored.streams[0].video.framesDecoded,120);assert.equal(stored.streams[0].video.framesDropped,null);
 assert.equal(JSON.stringify(stored).includes('secret'),false,'ingest strips arbitrary diagnostic fields');
 assert.equal(stored.videoDiagnosticsLimited,true,'explicit capture limit survives ingestion and video history export');
 const audioBody={...body,session:'ingest-audio-session',streams:[{...body.streams[0],kind:'audio'}]};
 assert.equal((await post(audioBody)).status,204);
 assert.equal((await store.readHistory(room,15,audioBody.session)).connections[0].latest.streams[0].video,undefined);
 const hour=Math.floor((Date.now()-3*86400000)/3600000),archiveRoom='video-archive',archiveTo=(hour+1)*3600000;
 const archived=Array.from({length:5},(_,i)=>({...sample('archived-session',i),room:archiveRoom,at:hour*3600000+1000+i*2000}));
 for(const s of archived)await store.saveSample(s);
 const first=await store.readVideoHistory(archiveRoom,60,{limit:2,to:archiveTo});
 const archiveDirectory=path.join(directory,require('node:crypto').createHash('sha256').update(archiveRoom).digest('hex'));
 const archive=load('../lib/telemetry-archives.ts');await archive.archiveTelemetryHour((await archive.telemetryHours(archiveDirectory))[0]);
 const rest=await store.readVideoHistory(archiveRoom,60,{to:archiveTo,cursor:first.nextCursor});
 assert.deepEqual([...first.samples,...rest.samples].map(s=>s.at),archived.map(s=>s.at),'video cursor survives raw-to-gzip archival');
 console.log('PASS exact video history, legacy counters, UTF-8/gzip paging, filters, tenant authorization, relay and sanitized ingest');
}finally{fs.rmSync(directory,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
