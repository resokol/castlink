const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),ts=require('typescript'),Module=require('node:module');
const original=Module._extensions['.ts'];
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-stats-archive-'));
process.env.STUDIOLINK_STATS_DIR=directory;
const {readHistory,readAudioHistory,clearDisconnected,cleanupStats}=require('../lib/telemetry-store.ts');
const {archiveTelemetryHour,telemetryHours,statsRetentionDays,historyEnd}=require('../lib/telemetry-archives.ts');
const HOUR=3600000,now=Date.now(),pastHour=Math.floor((now-3*86400000)/HOUR);
const room='archive-room',roomDir=path.join(directory,crypto.createHash('sha256').update(room).digest('hex'));
fs.mkdirSync(roomDir,{recursive:true});
const make=(hour,offset,session='archive-session')=>({at:hour*HOUR+offset,room,identity:'output-history',name:'История 🐻',session,role:'output',state:'connected',quality:'good',reconnects:0,uptimeSec:20,
 streams:[{id:'audio',participant:'guest',name:'Guest',kind:'audio',direction:'in',source:'microphone',bytes:offset,bitrateKbps:64,lossPct:1,jitterMs:2,rttMs:30,
 audio:{intervalMs:2000,receivedSamplesDelta:96000,concealedSamplesDelta:960,concealedPct:1}}]});
(async()=>{
 assert.equal(statsRetentionDays(),30);process.env.STUDIOLINK_STATS_RETENTION_DAYS='999';assert.equal(statsRetentionDays(),30);delete process.env.STUDIOLINK_STATS_RETENTION_DAYS;
 const raw=path.join(roomDir,`${pastHour}.jsonl`),samples=Array.from({length:180},(_,index)=>make(pastHour,1000+index*2000));
 // A large but valid-sized telemetry line forces several seekable gzip members.
 for(const sample of samples)sample.streams=Array.from({length:16},(_,i)=>({...sample.streams[0],id:`audio-${i}`,name:'Участник'.repeat(16),participant:'guest-'+i}));
 const contents=samples.map(sample=>JSON.stringify(sample)+'\n').join('');assert.ok(Buffer.byteLength(contents)>1024*1024);
 fs.writeFileSync(raw,contents,{mode:0o600});
 const to=(pastHour+1)*HOUR;
 const first=await readAudioHistory(room,60,{limit:150,to});assert.equal(first.samples.length,150);assert.ok(first.nextCursor);
 const descriptor=(await telemetryHours(roomDir))[0];
 await cleanupStats(true);
 assert.equal(fs.existsSync(raw),false,'raw is removed after successful archive publication');
 assert.ok(fs.existsSync(raw+'.gz'));assert.ok(fs.existsSync(path.join(roomDir,`${pastHour}.idx.json`)));
 assert.equal(zlib.gunzipSync(fs.readFileSync(raw+'.gz')).toString(),contents,'gzip retains every original two-second record verbatim');
 const index=JSON.parse(fs.readFileSync(path.join(roomDir,`${pastHour}.idx.json`),'utf8'));assert.ok(index.members.length>=2);assert.equal(index.rawBytes,Buffer.byteLength(contents));
 assert.ok(fs.statSync(raw+'.gz').size<Buffer.byteLength(contents)/5,'repeated numeric telemetry compresses compactly');
 const second=await readAudioHistory(room,60,{limit:150,to,cursor:first.nextCursor});
 assert.equal(second.samples.length,30);assert.deepEqual(second.samples.map(sample=>sample.at),samples.slice(150).map(sample=>sample.at),'logical raw cursor stays stable across compression and UTF8 member seeks');
 // A descriptor obtained immediately before compression can also open the archived replacement.
 const {openTelemetryHour}=require('../lib/telemetry-archives.ts');const stale=await openTelemetryHour(descriptor);stale.close();
 await clearDisconnected(room);
 const history=await readHistory(room,60,'archive-session',true,undefined,undefined,to);
 assert.equal(history.connections.length,1,'list reset does not hide a selected past day');assert.equal(history.connections[0].latest.at,samples.at(-1).at);
 assert.equal(history.series.find(point=>point.at===Math.floor(samples[1].at/2000)*2000).audioIn,16*64,'archive maintains two-second stream aggregation');
 assert.equal(history.series.find(point=>point.at===pastHour*HOUR+400000).audioIn,null,'no archive gap interpolation');
 assert.equal(history.retention.days,30);assert.equal(history.retention.availableFrom,pastHour*HOUR);
 assert.equal((await readHistory('another-room',60,undefined,true,undefined,undefined,to)).connections.length,0,'archived history remains room-isolated');
 assert.equal((await readAudioHistory(room,60,{to,session:'missing-session'})).samples.length,0);
 // Block publishing the archive: original bytes must survive, with no temporary file left behind.
 const failHour=pastHour-1,failRaw=path.join(roomDir,`${failHour}.jsonl`),failContent=JSON.stringify(make(failHour,1000))+'\n';
 fs.writeFileSync(failRaw,failContent);fs.mkdirSync(failRaw+'.gz');
 await archiveTelemetryHour((await telemetryHours(roomDir)).find(hour=>hour.hour===failHour));
 assert.equal(fs.readFileSync(failRaw,'utf8'),failContent,'publication failure keeps complete original raw data');
 assert.equal(fs.readdirSync(roomDir).some(file=>file.endsWith('.tmp')),false);fs.rmdirSync(failRaw+'.gz');
 // Remove expired logical hours, including archives and seek indexes; preserve recent history.
 const expiredHour=Math.floor((now-32*86400000)/HOUR),expiredRaw=path.join(roomDir,`${expiredHour}.jsonl`);
 fs.writeFileSync(expiredRaw,JSON.stringify(make(expiredHour,1000))+'\n');await archiveTelemetryHour((await telemetryHours(roomDir)).find(hour=>hour.hour===expiredHour));
 await cleanupStats(true);assert.equal(fs.existsSync(expiredRaw+'.gz'),false);assert.equal(fs.existsSync(path.join(roomDir,`${expiredHour}.idx.json`)),false);
 assert.ok(fs.existsSync(raw+'.gz'),'30-day retention keeps three-day-old history');
 await assert.rejects(readAudioHistory(room,60,{to:now-31*86400000}),/invalid_audio_end/);
 assert.throws(()=>historyEnd(now+10000),/invalid_audio_end/);
 // A sparse raw hour exercises the real global byte budget without allocating a giant buffer.
 process.env.STUDIOLINK_STATS_MAX_BYTES=String(64*1024*1024);
 const largeHour=Math.floor((now-24*HOUR)/HOUR),largeRaw=path.join(roomDir,`${largeHour}.jsonl`);
 fs.writeFileSync(largeRaw,'');fs.truncateSync(largeRaw,65*1024*1024);await cleanupStats(true);
 assert.equal(fs.existsSync(largeRaw),false,'global cap evicts oldest logical hours until within budget');assert.equal(fs.existsSync(raw+'.gz'),false,'archives participate in the same byte budget');
 console.log('PASS: compact exact gzip archives, indexed members, stable raw-to-gzip cursor, old descriptor fallback, 2s metrics/gaps, historical reset behavior, room/session boundaries, publication failure keeps raw, 30-day pruning, global raw/archive byte budget');
})().finally(()=>{fs.rmSync(directory,{recursive:true,force:true});delete process.env.STUDIOLINK_STATS_MAX_BYTES;delete process.env.STUDIOLINK_STATS_RETENTION_DAYS;if(original)Module._extensions['.ts']=original;else delete Module._extensions['.ts'];})
.catch(error=>{console.error(error);process.exitCode=1;});
