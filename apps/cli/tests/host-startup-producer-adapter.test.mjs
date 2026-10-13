import test from 'node:test';
import assert from 'node:assert/strict';
import {publishHostControllerFromCursor} from '../dist/host-startup-producer-runner.js';
test('POSIX-only producer refuses native SID before entering a target effect',async()=>{
 let effects=0;const cursor={remote:false,readOnly:false,binding:{schemaVersion:1,engine:'fixture',endpoint:'npipe:////./pipe/dockerDesktopLinuxEngine',epoch:0,principal:{kind:'windows-sid',sid:'S-1-5-21-1-2-3-1001'},scope:'D:\\fixture\\.castlink-target-operations'},effect:async fn=>{effects++;return fn();}};
 await assert.rejects(publishHostControllerFromCursor(cursor,{}),/host-producer-target-runtime-unavailable/);assert.equal(effects,0);
});
