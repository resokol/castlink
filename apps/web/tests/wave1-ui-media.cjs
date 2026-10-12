const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");
const studio = fs.readFileSync(path.resolve(__dirname, "../components/StudioWorkspace.tsx"), "utf8");
const share = fs.readFileSync(path.resolve(__dirname, "../components/ScreenShareButton.tsx"), "utf8");
const rotation = fs.readFileSync(path.resolve(__dirname, "../lib/video-rotation.ts"), "utf8");
const guestMeter = fs.readFileSync(path.resolve(__dirname, "../components/GuestAudioMeter.tsx"), "utf8");
const pcmMeter = fs.readFileSync(path.resolve(__dirname, "../lib/audio-meter.ts"), "utf8");

assert.match(share, /setTimeout\(\(\) => setError\(""\), 5000\)/, "screen-share error must auto-dismiss");
assert.match(css, /--action-gap:\s*10px/, "shared action spacing token is required");
assert.match(css, /--section-gap:\s*18px/, "shared section spacing token is required");
assert.doesNotMatch(css, /studio-tabs button:last-child[^}]*color:/, "participants tab must not be forced red");
assert.match(css, /guest-mini-video[^}]*object-fit:contain/, "legacy guest preview must not crop video");
assert.match(css, /remote-video-source video[^}]*object-fit:\s*contain !important/, "remote preview must preserve full frame");

assert.match(rotation, /video\.parentElement/, "rotation must use the rendered frame geometry");
assert.match(rotation, /resize\.observe\(frame\)/, "rotation must react to parent/fullscreen resize");
assert.match(rotation, /applyContainedVideoFit/, "rotation uses tested decoded-frame geometry");

assert.match(studio, /import \{ GuestAudioMeter \} from "@\/components\/GuestAudioMeter"/, "studio uses the extracted guest PCM meter");
assert.match(studio, /<GuestAudioMeter track=\{room\.remoteParticipants\.get\(g\.identity\)\?\.getTrackPublication\(Track\.Source\.Microphone\)\?\.track/, "the rendered meter receives the current remote microphone publication");
assert.match(guestMeter, /observePcmTrack\(mediaTrack, setDb/, "guest meter observes the actual remote media track");
assert.match(pcmMeter, /analyser\.fftSize = 2048/, "participant meter preserves the analyser resolution");
assert.match(pcmMeter, /new MediaStream\(\[track\]\)/, "PCM observer reads the supplied live track");
assert.doesNotMatch(guestMeter + pcmMeter, /\.clone\(|track\.stop\(/, "analysis neither clones nor stops the SDK-owned remote track");
assert.match(pcmMeter, /getFloatTimeDomainData\(samples\)/, "meter reads waveform samples rather than a smoothed frequency estimate");
assert.match(pcmMeter, /peakDbfs\(samples\)/, "participant meter uses measured peak dBFS");

console.log("PASS: Wave 1 UI/media regressions stay aligned with CastLink design and monitoring invariants");
