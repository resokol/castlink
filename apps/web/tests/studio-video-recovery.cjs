const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { watchStudioVideo } = require('../lib/studio-video-recovery.ts');
const timers = new Map(); let id = 0;
global.setTimeout = (fn, delay) => { const key = ++id; timers.set(key, { fn, delay }); return key; };
global.clearTimeout = key => timers.delete(key);
async function tick(delay) {
  const entry = [...timers].find(([, v]) => v.delay === delay);
  assert.ok(entry, `timer ${delay} exists`); timers.delete(entry[0]); await entry[1].fn();
}
let frames = 10; const changes = [];
const publication = { kind: 'video', trackSid: 'video', isDesired: true, isMuted: false,
  track: { getRTCStatsReport: async () => new Map([['in', { type: 'inbound-rtp', kind: 'video', framesDecoded: frames }]]) },
  setSubscribed(value) { this.isDesired = value; changes.push(value); },
};
const participant = { identity: 'studio-panel-test', videoTrackPublications: new Map([['video', publication]]) };
const room = { state: 'connected', remoteParticipants: new Map([['studio', participant]]) };
(async () => {
  let videoEnabled = true;
  const stop = watchStudioVideo(room, () => videoEnabled);
  await tick(5000); frames++; await tick(5000); assert.deepEqual(changes, []);
  await tick(5000); await tick(5000); assert.deepEqual(changes, [], 'avoid recovering a brief stall');
  await tick(5000); assert.deepEqual(changes, [false]); await tick(250); assert.deepEqual(changes, [false, true]);
  publication.isMuted = true; for (let i = 0; i < 5; i++) await tick(5000);
  assert.equal(changes.length, 2, 'muted publisher is not recovered');
  publication.isMuted = false; publication.isDesired = false;
  for (let i = 0; i < 5; i++) await tick(5000);
  assert.equal(changes.length, 2, 'disabled video stays disabled');
  publication.isDesired = true;
  for (let i = 0; i < 4; i++) await tick(5000);
  assert.equal(changes.length, 3); videoEnabled = false; await tick(250);
  assert.equal(changes.length, 3, 'disable during recovery must not resubscribe');
  videoEnabled = true; publication.isDesired = true;
  for (let i = 0; i < 4; i++) await tick(5000);
  stop(); assert.equal(timers.size, 0, 'cleanup cancels pending recovery');
  const hungPublication={...publication,isDesired:true,track:{getRTCStatsReport:()=>new Promise(()=>{})}};
  const hungParticipant={identity:'studio-panel-hung',videoTrackPublications:new Map([['video',hungPublication]])};
  const stopHung=watchStudioVideo({state:'connected',remoteParticipants:new Map([['s',hungParticipant]])});
  const pendingPoll=tick(5000);
  assert.ok([...timers.values()].some(t=>t.delay===1500),'unresolved stats must have a deadline');
  await tick(1500);await pendingPoll;assert.ok([...timers.values()].some(t=>t.delay===5000),'poll continues after stats deadline');stopHung();
  let releaseStats;videoEnabled=true;publication.isDesired=true;publication.track={getRTCStatsReport:async()=>new Map([['v',{type:'inbound-rtp',kind:'video',framesDecoded:10}]])};
  const stopIntent=watchStudioVideo(room,()=>videoEnabled);for(let i=0;i<3;i++)await tick(5000);
  publication.track.getRTCStatsReport=()=>new Promise(resolve=>releaseStats=resolve);const inFlight=tick(5000);await Promise.resolve();videoEnabled=false;
  const before=changes.length;releaseStats(new Map([['v',{type:'inbound-rtp',kind:'video',framesDecoded:10}]]));await inFlight;assert.equal(changes.length,before,'disable during pending stats must not unsubscribe/recover');stopIntent();
  videoEnabled=true;publication.isDesired=true;const stopDuring=watchStudioVideo(room);const finalPoll=tick(5000);await Promise.resolve();stopDuring();releaseStats(new Map());await finalPoll;assert.equal(timers.size,0,'cleanup during stats await never rearms the watchdog');
  console.log('PASS: flowing video, prolonged stall recovery, mute, disabled video, cleanup');
  console.log('PASS: hung stats deadline, polling resumes, intent rechecked after await, cleanup during pending stats');
})().catch(e => { console.error(e); process.exitCode = 1; });
