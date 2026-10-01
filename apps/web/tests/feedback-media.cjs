const assert = require("node:assert/strict");
const fs = require("node:fs"), ts = require("typescript");
require.extensions[".ts"] = (module,file) => module._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {videoFitGeometry} = require("../lib/video-fit.ts");
const {peakDbfs,meterRelease} = require("../lib/audio-meter.ts");
const {capStudioVideoEncodings,guestVideoBitrate} = require("../lib/video-quality.ts");
for (const [w,h] of [[720,1280],[1280,720],[1080,1920],[640,480]]) for (const [fw,fh] of [[360,203],[1920,1080],[390,300]]) for (const angle of [0,90,180,270]) {
 const fit=videoFitGeometry(fw,fh,w,h,angle);
 assert.ok(fit.rotatedWidth<=fw+1e-8 && fit.rotatedHeight<=fh+1e-8,"the entire rotated frame must remain inside its parent");
 assert.ok(Math.abs(fit.width/fit.height-w/h)<1e-8,"no stretching of native camera aspect ratio");
 assert.ok(Math.abs(fit.rotatedWidth-fw)<1e-8 || Math.abs(fit.rotatedHeight-fh)<1e-8,"use the largest contained frame");
}
assert.equal(videoFitGeometry(0,1,1,1,90),null);
assert.ok(Math.abs(peakDbfs([0,.0001,-.0001])+80)<1e-7,"quiet -80 dBFS samples must not be gated at -60");
assert.equal(peakDbfs([0,0]),-90);
assert.equal(meterRelease(-20,-80,100),-22.4,"fall smoothly instead of snapping to silence");
assert.equal(meterRelease(-80,-20,100),-20,"fast meter attack");
for (const budget of [500,2500,8000,12000]) {
 const capped=capStudioVideoEncodings([{rid:"q",maxBitrate:150000},{rid:"h",maxBitrate:500000},{rid:"f",maxBitrate:10000000}],budget,30);
 assert.equal(capped.reduce((n,e)=>n+e.maxBitrate,0),budget*1000,"sum of all simulcast encodings is capped");
}
assert.equal(guestVideoBitrate(),2500); assert.equal(guestVideoBitrate('{"videoMaxBitrateKbps":8000}'),8000); assert.equal(guestVideoBitrate('{"videoMaxBitrateKbps":-1}'),2500);
console.log("PASS: 48 native aspect/rotation cases, quiet meter signals, ballistic release, aggregate camera caps");
