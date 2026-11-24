const assert = require("node:assert/strict");
const fs = require("node:fs/promises"), os = require("node:os"), path = require("node:path");
const { load } = require("./load-typescript.cjs");

(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "castlink-room-sfu-test-"));
  const savedStatsDir = process.env.STUDIOLINK_STATS_DIR;
  const savedKey = process.env.LIVEKIT_API_KEY, savedSecret = process.env.LIVEKIT_API_SECRET;
  process.env.STUDIOLINK_STATS_DIR = directory;
  process.env.LIVEKIT_API_KEY = "test"; process.env.LIVEKIT_API_SECRET = "test";
  try {
    const { readRoomSfuEvidence, streamRoomSfuEvidence, saveRoomSfuEvidence, roomPublicationSnapshot } = load("../lib/room-sfu-evidence.ts");
    const { roomDirectory } = load("../lib/telemetry-store.ts");
    const { telemetryHours, archiveTelemetryHour } = load("../lib/telemetry-archives.ts");
    const { mediaRoomName } = load("../lib/studio-scope.ts");
    const room = mediaRoomName("tenant-a", "shared"), other = mediaRoomName("tenant-b", "shared");
    const at = (Math.floor(Date.now()/3600000) - 1)*3600000 + 1000;
    const p = (identity, sid, muted = false) => ({ identity, metadata: "secret", name: "private", tracks: [
      { sid, type: 1, muted, mimeType: "video/VP8", cname: "private" }, { sid: "data", type: 2, muted: false } ] });
    const people = [p("guest", "TR_V"), p("studio", "TR_X", true)];
    let snapshot = roomPublicationSnapshot(people, at);
    assert.deepEqual(snapshot.tracks, [{ participant:"guest",trackSid:"TR_V",kind:"video",muted:false },
      { participant:"studio",trackSid:"TR_X",kind:"video",muted:true }]);
    assert.equal(roomPublicationSnapshot(Array.from({length:70}, (_,i)=>p("guest"+i,"TR_"+i)),at).limited,true);
    await saveRoomSfuEvidence(room, snapshot);
    await saveRoomSfuEvidence(room, { ...snapshot, at: at + 15000 });
    await saveRoomSfuEvidence(room, { ...snapshot, at: at + 60000 });
    for (let i = 2; i < 25; i++) await saveRoomSfuEvidence(room, { ...snapshot, at: at + i*60000 });
    await saveRoomSfuEvidence(other, roomPublicationSnapshot([p("other-tenant", "TR_PRIVATE")], at));
    const store = roomDirectory("\0sfu-publications\0" + room);
    const [hour] = await telemetryHours(store);
    const compact = (await fs.readFile(hour.raw, "utf8")).trim().split("\n").map(JSON.parse);
    assert.ok(Array.isArray(compact[0].tracks));
    assert.equal(compact.slice(1).every(row => row.anchor && !row.tracks), true);
    await fs.appendFile(hour.raw, JSON.stringify({room:other, ...roomPublicationSnapshot([p("other-tenant","TR_PRIVATE")],at)})+"\n");
    await archiveTelemetryHour(hour);
    const selected = await readRoomSfuEvidence(room, at-1, at + 25*60000, {identity:"guest"});
    assert.equal(selected.observedSamples,25);
    assert.equal(selected.skippedRecords,1);
    assert.ok(selected.samples.length <= 12);
    assert.equal(selected.limited,true);
    assert.equal(selected.samples[0].tracks.length,1);
    assert.equal(selected.perTrackRtp,"unavailable");
    assert.doesNotMatch(JSON.stringify(selected),/studio|other-tenant|TR_PRIVATE|cname|mimeType|private|secret/);
    assert.equal((await readRoomSfuEvidence(room, at, at+60000, {session:"guest-123456"})).reason,"unmapped-filter");
    assert.equal((await readRoomSfuEvidence(room, at, at+60000, {role:"guest"})).reason,"unmapped-filter");
    assert.equal((await readRoomSfuEvidence("missing", at, at+60000)).reason,"no-observations");
    const complete=[];
    for await(const row of streamRoomSfuEvidence(room,at,at+25*60000)) complete.push(row.at);
    assert.equal(complete.length,25);
    assert.equal(complete[0],at);
    const stop=new AbortController(), iterator=streamRoomSfuEvidence(room,at,at+25*60000,{signal:stop.signal});
    assert.equal((await iterator.next()).done,false);
    stop.abort(); await assert.rejects(iterator.next(),{name:"AbortError"});

    const roomEvicted = "test-evicted";
    await saveRoomSfuEvidence(roomEvicted, snapshot);
    const [beforeEviction] = await telemetryHours(roomDirectory("\0sfu-publications\0" + roomEvicted));
    await fs.unlink(beforeEviction.raw);
    await saveRoomSfuEvidence(roomEvicted, { ...snapshot, at: at + 60_000 });
    const afterEviction = await readRoomSfuEvidence(roomEvicted, at, at + 60_000);
    assert.equal(afterEviction.observedSamples, 1);
    assert.equal(afterEviction.skippedRecords, 0);
    const calls = [];
    const { collectServerMonitorSample } = load("../lib/server-monitor.ts", {
      "livekit-server-sdk":{ RoomServiceClient:class {
        async listRooms() { calls.push("rooms"); return [{name:room},{name:"castlink-private-talkback"}]; }
        async listParticipants(name) { calls.push(name); return people; }
      } },
      "./room-store":{readNodeRoomInventory:async()=>[{studioId:"tenant-a",name:"shared"}]},
      "./persistent-storage":{productionDataDir:()=>directory,persistentStatsDir:()=>directory},
    });
    const runtimeSample = await collectServerMonitorSample();
    assert.equal(runtimeSample.services.livekit,"ok");
    assert.deepEqual(calls,["rooms",room,"castlink-private-talkback"]);
    assert.doesNotMatch(JSON.stringify(runtimeSample),/TR_|castlink-private|guest|tenant/);
    const current = await readRoomSfuEvidence(room, Date.now()-6000, Date.now()+100);
    assert.equal(current.samples[0].tracks.length,2);
    assert.equal((await readRoomSfuEvidence("castlink-private-talkback",at,Date.now()+100)).reason,"no-observations");
    // A rejected worker can finish before another worker returns its valid roster.
    for (const mode of ["failed", "deadline"]) {
      const successfulRoom = mediaRoomName("tenant-a", mode);
      const requested = [];
      const originalNow = Date.now;
      const start = originalNow();
      let now = start;
      Date.now = () => now;
      try {
        const monitor = load("../lib/server-monitor.ts", {
          "livekit-server-sdk": { RoomServiceClient: class {
            async listRooms() { return [successfulRoom, "another-room"].map(name => ({ name })); }
            async listParticipants(name) {
              requested.push(name);
              if (name !== successfulRoom) throw Error("unavailable");
              if (mode === "deadline") now += 4100;
              await new Promise(resolve => setImmediate(resolve));
              return people;
            }
          } },
          "./room-store": { readNodeRoomInventory: async () => [{ studioId: "tenant-a", name: mode }] },
          "./persistent-storage": { productionDataDir: () => directory, persistentStatsDir: () => directory },
        });
        const partial = await monitor.collectServerMonitorSample();
        assert.equal(partial.services.livekit, "unavailable");
        assert.deepEqual([partial.activeRooms, partial.connections, partial.casters], [null, null, null]);
        const history = await readRoomSfuEvidence(successfulRoom, start, now);
        assert.equal(history.observedSamples, 1, mode + " must retain the successful scoped roster");
        assert.equal(history.samples[0].tracks.length, 2);
        assert.deepEqual(requested, mode === "deadline" ? [successfulRoom] : [successfulRoom, "another-room"]);
      } finally { Date.now = originalNow; }
    }
    console.log("PASS RoomService publication snapshots, existing request reuse, coalescing, private-room exclusion, room/identity scope, compression, full series, bounded summary and cancellation");
  } finally {
    for (const [name,value] of [["STUDIOLINK_STATS_DIR",savedStatsDir],["LIVEKIT_API_KEY",savedKey],["LIVEKIT_API_SECRET",savedSecret]]) {
      if(value === undefined) delete process.env[name]; else process.env[name]=value;
    }
    await fs.rm(directory,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error); process.exitCode=1;});
