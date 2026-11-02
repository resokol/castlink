'use strict';
function startFailure(reply,permissions){
 if(reply?.ok===true&&reply.state?.ready===true&&reply.state?.pointerReady===true)return null;
 const missing=['screen','accessibility','inputMonitoring'].some(key=>permissions?.[key]===false);
 const permissionFailure=['REMOTE_INPUT_UNAVAILABLE','REMOTE_INPUT_MONITORING_PERMISSION','REMOTE_INPUT_DESKTOP'].includes(reply?.error||reply?.state?.error);
 return {status:missing&&permissionFailure?'NOT VERIFIED':'FAILED',reason:reply?.error||reply?.state?.error||'native fixture source did not become ready',...(reply?.diagnostic?{bindingDiagnostic:reply.diagnostic}:{})};
}
module.exports={startFailure};

// This is a geometry/crop oracle, not a test of display primary color accuracy.
// Distinct black/white IDs survive a display profile's primary conversion while
// preserving the original strict 0.15 per-channel pixel threshold.
function assertCornerFiducials(capture,{width,height,scale}){
 const assert=require('node:assert/strict'),threshold=0.15;
 assert.ok(Number.isFinite(scale)&&scale>0,'invalid backing scale');
 assert.equal(capture.verified,true,'real ScreenCaptureKit capture unavailable');
 assert.equal(capture.width,width,'capture backing width differs');assert.equal(capture.height,height,'capture backing height differs');
 assert.equal(capture.sampleColorSpace,'sRGB','fiducial samples must declare explicit sRGB conversion');
 assert.equal(capture.markerScheme,'castlink-binary-corners-v1','unknown fiducial scheme');
 assert.ok(Array.isArray(capture.fiducials)&&capture.fiducials.length===4,'four corner fiducials required');
 const names=['top-left','top-right','bottom-left','bottom-right'],bits=[[0,0],[0,1],[1,0],[1,1]];
 for(let corner=0;corner<4;corner++){
  const marker=capture.fiducials[corner],right=corner%2===1,bottom=corner>=2;
  assert.equal(marker.corner,names[corner],'corner identity or orientation differs');
  const y=Math.round(bottom?height-60*scale:20*scale),pixels=[20,44].map(x=>[Math.round(right?width-(80-x)*scale:x*scale),y]);
  assert.deepEqual(marker.pixels,pixels,names[corner]+' sample coordinates differ from the backing transform');
  assert.ok(Array.isArray(marker.samples)&&marker.samples.length===2,names[corner]+' needs two measured cells');
  for(let bit=0;bit<2;bit++){
   const rgb=marker.samples[bit],expected=bits[corner][bit];
   assert.ok(Array.isArray(rgb)&&rgb.length===3&&rgb.every(n=>Number.isFinite(n)&&Math.abs(n-expected)<threshold),names[corner]+' cell '+bit+' expected '+(expected?'white':'black')+' within '+threshold+' per channel, measured '+JSON.stringify(rgb));
  }
 }
 return {scheme:capture.markerScheme,comparison:'black-white-per-channel',threshold,corners:names};
}
module.exports.assertCornerFiducials=assertCornerFiducials;

async function waitForReceiverWatchdog({readEvents,readState,keyCode,afterIndex,heartbeatSentMonotonic,leaseDeadlineMonotonic,geometryRevision,now=()=>performance.now(),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),timeoutMs=1500}){
 const assert=require('node:assert/strict'),deadline=now()+timeoutMs;
 let state;
 do{
  const released=readEvents().slice(afterIndex).find(value=>value.event==='keyUp'&&value.keyCode===keyCode);
  if(released){
   assert.ok(Number.isFinite(released.observedMonotonic),'watchdog key-up must have an observation timestamp');
   assert.ok(released.observedMonotonic-heartbeatSentMonotonic>=450,'key was released before the receiver-timeout probe');
   assert.ok(released.observedMonotonic<leaseDeadlineMonotonic,'key-up arrived at '+released.observedMonotonic+' after the700ms proof deadline '+leaseDeadlineMonotonic+'; receiver watchdog is not proved');
  }
  state=readState();
  if(released&&state?.needsEmptyReset===true&&state.active===false){
   assert.equal(state.geometry?.revision,geometryRevision,'geometry changed during watchdog probe');
   assert.ok(state.ready===true&&state.pointerReady===true,'source lost readiness during watchdog probe');
   assert.ok(['REMOTE_INPUT_REPLAY','REMOTE_INPUT_LEASE'].includes(state.error),'receiver pause must carry a watchdog diagnostic');
   return {keyUpObservedMonotonic:released.observedMonotonic,keyUpAfterHeartbeatMs:released.observedMonotonic-heartbeatSentMonotonic,serverLeaseDeadlineMonotonic:leaseDeadlineMonotonic,state};
  }
  await wait(10);
 }while(now()<deadline);
 throw Error('receiver watchdog did not deliver both native key-up and paused helper state within '+timeoutMs+'ms; last state='+JSON.stringify(state));
}
module.exports.waitForReceiverWatchdog=waitForReceiverWatchdog;
