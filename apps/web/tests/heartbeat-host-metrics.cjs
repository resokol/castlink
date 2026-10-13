const assert=require("node:assert/strict");
(async()=>{
 const {networkOutRate}=await import("../../../scripts/heartbeat-host-metrics.mjs");
 assert.equal(networkOutRate(null,{at:1000,bytes:{eth0:10}}),null);
 assert.equal(networkOutRate({at:1000,bytes:{eth0:100}},{at:2000,bytes:{eth0:125100}}),1);
 assert.equal(networkOutRate({at:1000,bytes:{eth0:100}},{at:2000,bytes:{eth0:0}}),null);
 assert.equal(networkOutRate({at:1000,bytes:{eth0:100}},{at:200000,bytes:{eth0:1000000}}),null);
 assert.equal(networkOutRate({at:1000,bytes:{eth0:100}},{at:2000,bytes:{eth0:100}}),0);
 console.log("PASS: measured host egress, first sample unavailable, counter reset, stale interval and actual zero");
})().catch(error=>{console.error(error);process.exitCode=1;});
