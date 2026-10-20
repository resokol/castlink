const assert = require("node:assert/strict"), fs = require("node:fs"), ts = require("typescript");
require.extensions[".ts"] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, f);
const protocol = require("../lib/guest-media-control.ts");
const custom = { mode: "custom", resolution: "1920x1080", frameRate: "29.97" };
assert.deepEqual(protocol.parseGuestMediaSettingsPatch({ cameraCapture: custom }), { cameraCapture: custom }, "remote capture settings use existing validated protocol");
const capture = require("../lib/guest-capture-settings.ts");
const video = require("../lib/guest-video-codec.ts");
const media = require("../lib/guest-media.ts");
const quality = require("../lib/video-quality.ts");
for (const fps of [29.97,24,20,15,10,5,2,120]) assert.equal(quality.capStudioVideoEncodings([{maxBitrate:4000000}],4000,fps,true)[0].maxFramerate,fps);
assert.throws(() => quality.capStudioVideoEncodings([{maxBitrate:4000000}],4000,24), /Некорректный/);
for (const value of [null, [], {}, { ...custom, mode: "bad" }, { ...custom, resolution: "99999x1" }, { ...custom, frameRate: "NaN" }, { ...custom, extra: true }]) {
  assert.equal(capture.parseGuestCameraCapture(value), undefined);
  assert.equal(protocol.parseGuestMediaSettingsPatch({ cameraCapture: value }), undefined);
}
const state = { audioProfile: "speech", connectionRoute: "normal", cameraCapture: custom, cameraCaptureSupported: true, actualCameraCapture: { width: 1280, height: 720, frameRate: 30 } };
assert.deepEqual(protocol.parseGuestMediaSettingsState(state), state);
assert.equal(protocol.parseGuestMediaSettingsState({ ...state, actualCameraCapture: { width: Infinity, height: 720, frameRate: 30 } }), undefined);
assert.deepEqual(media.guestCaptureConstraints({ height: 720, cameraCapture: custom, audioEnabled: false }).video.width, { ideal: 1920 });
assert.equal(media.guestCaptureConstraints({ height: 720, cameraCapture: { ...custom, mode: "device" }, audioEnabled: false }).video.height, undefined);
function makeRoom(enabled = true) {
  const room = { state: "connected", calls: [], fail: false };
  const native = { getSettings: () => ({ width: 1280, height: 720, frameRate: 30 }), getConstraints: () => ({ height: { ideal: 720 } }), getCapabilities: () => ({ frameRate: { max: 60 } }), async applyConstraints(value) { room.calls.push(value); if (room.afterApply) room.afterApply(); if (room.fail) throw new Error("private native detail"); } };
  room.localParticipant = { sid: "PA-one", isCameraEnabled: enabled, getTrackPublication: source => { assert.equal(source, "camera"); return { track: { mediaStreamTrack: native } }; } };
  return room;
}
(async () => {
  const room = makeRoom();
  assert.equal(await video.switchGuestCameraCapture(room, custom, () => true), true);
  assert.deepEqual(room.calls[0].width, { ideal: 1920 });
  assert.deepEqual(room.calls[0].frameRate, { ideal: 29.97 });
  assert.deepEqual(video.guestCameraCaptureState(room, { cameraCapture: custom }).actualCameraCapture, { width: 1280, height: 720, frameRate: 30 }, "actual camera fallback remains honest");
  const highest = makeRoom(); await video.switchGuestCameraCapture(highest, { ...custom, frameRate: "highest" }, () => true);
  assert.deepEqual(highest.calls[0].frameRate, { ideal: 60 });
  const device = makeRoom(); await video.switchGuestCameraCapture(device, { ...custom, mode: "device" }, () => true);
  assert.deepEqual(device.calls[0], {}, "device defaults clear custom dimensions and FPS");
  const off = makeRoom(false); assert.equal(await video.switchGuestCameraCapture(off, custom, () => true), true); assert.equal(off.calls.length, 0, "off camera stays off");
  const failed = makeRoom(); failed.fail = true; await assert.rejects(video.switchGuestCameraCapture(failed, custom, () => true), /Не удалось применить параметры захвата камеры/);
  const moved = makeRoom(); moved.afterApply = () => { moved.localParticipant.sid = "PA-new"; };
  assert.equal(await video.switchGuestCameraCapture(moved, custom, () => true), false); assert.equal(moved.calls.length, 1, "old session cannot roll back new SID");
  const movedFailure = makeRoom(); movedFailure.fail = true; movedFailure.afterApply = () => { movedFailure.localParticipant.sid = "PA-new"; };
  await assert.rejects(video.switchGuestCameraCapture(movedFailure, custom, () => true));
  assert.equal(movedFailure.calls.length, 1, "resizeMode retry cannot mutate camera restored under a new SID");
  const unknown = makeRoom(); unknown.localParticipant.getTrackPublication("camera").track.mediaStreamTrack.getCapabilities = () => ({});
  await assert.rejects(video.switchGuestCameraCapture(unknown, { ...custom, frameRate: "highest" }, () => true), /максимальную частоту/);
  console.log("PASS: camera capture protocol, bounded validation, constraints, honest actual values, highest/defaults, off-state and SID cancellation");
})().catch(error => { console.error(error); process.exitCode = 1; });
