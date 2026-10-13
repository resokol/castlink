const assert=require("node:assert/strict"),fs=require("node:fs"),ts=require("typescript");
require.extensions[".ts"]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {rememberLiveSample,latestLiveSamples,resetLiveTelemetryForTests}=require("../lib/live-telemetry-cache.ts");
(async()=>{
 resetLiveTelemetryForTests();let calls=0;
 const seed=async()=>{calls++;return [{room:"qa",identity:"a",name:"Old",at:1}];};
 await Promise.all(Array.from({length:8},()=>latestLiveSamples("qa",seed)));assert.equal(calls,1,"one cold read for parallel topology requests");
 rememberLiveSample({room:"qa",identity:"a",name:"New",at:3});rememberLiveSample({room:"qa",identity:"a",name:"Stale",at:2});
 assert.equal((await latestLiveSamples("qa",seed)).get("a").name,"New");assert.equal(calls,1,"steady-state updates do not rescan retained history");
 rememberLiveSample({room:"other",identity:"a",name:"Other",at:4});assert.equal((await latestLiveSamples("qa",seed)).size,1);
 for(let i=0;i<5000;i++) rememberLiveSample({room:"bulk",identity:String(i),at:i});
 assert.equal((await latestLiveSamples("bulk",async()=>[])).size,4096,"live cache is bounded");
 resetLiveTelemetryForTests();console.log("PASS: shared bounded topology cache, one cold seed, monotonic rename and room isolation");
})().catch(error=>{console.error(error);process.exitCode=1;});
