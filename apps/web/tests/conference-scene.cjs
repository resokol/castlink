const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const fs = require('node:fs');
const path = require('node:path');
const source = path.join(__dirname, '../lib/conference-scene.ts');
assert(fs.existsSync(source), 'responsive scene selection policy must exist');
const { advanceSpeaker, primarySceneSource, sceneSplit, sceneGallery } = load('../lib/conference-scene.ts');
let state = { selected: 'a', candidate: '', since: 0 };
state = advanceSpeaker(state, ['b'], ['a','b'], 0);
assert.equal(state.selected, 'a');
state = advanceSpeaker(state, ['b'], ['a','b'], 999);
assert.equal(state.selected, 'a', 'short bursts must not switch');
state = advanceSpeaker(state, ['b'], ['a','b'], 1000);
assert.equal(state.selected, 'b', 'stable speaker selected after 1000 ms');
state = advanceSpeaker(state, [], ['a','b'], 4000);
assert.equal(state.selected, 'b', 'silence retains last speaker');
state = advanceSpeaker(state, ['a'], ['a','b'], 5000);
state = advanceSpeaker(state, ['b'], ['a','b'], 5500);
assert.equal(state.candidate, '', 'candidate returning to selected cancels pending switch');
state = advanceSpeaker(state, ['hidden'], ['a'], 6000);
assert.equal(state.selected, 'a', 'departed speaker replaced using visible roster only');
const sources = [{id:'a-cam',identity:'a',kind:'camera'},{id:'s1',identity:'b',kind:'screen'},{id:'s2',identity:'a',kind:'screen'}];
assert.equal(primarySceneSource(sources, 'a', 's1'), 's1', 'screen stays primary while another speaks');
assert.equal(primarySceneSource(sources, 'b', 's2'), 's2', 'multiple screens keep current screen');
assert.equal(primarySceneSource(sources.slice(0,1), 'a', 's1'), 'a-cam');
assert.equal(primarySceneSource([], 'a', 's1'), '');
assert.equal(sceneSplit(NaN), 0.88); assert.equal(sceneSplit(0), 0.5); assert.equal(sceneSplit(1), 0.88);
for (const [width,height] of [[360,500],[1024,580],[1920,900],[1920,1050],[2560,900]]) {
  const fit = sceneGallery(6,width,height);
  assert(fit.columns * fit.rows >= 6);
  assert(Math.abs(fit.tileWidth / fit.tileHeight - 16/9) < .0001, 'equal 16:9 frames without deformation');
}
for (const count of [6, 12, 20]) for (const [width,height] of [[320,240],[844,220],[1440,500]]) {
  const fit = sceneGallery(count,width,height);
  assert(fit.columns * fit.tileWidth + (fit.columns - 1) * 8 <= width + 1, 'gallery stays inside the viewing width');
  assert(fit.rows * fit.tileHeight + (fit.rows - 1) * 8 <= height + 1, 'gallery fits the viewing height without an internal scrollbar');
}
console.log('PASS scene: speaker hysteresis, source priority, local split and proportional gallery');

const { sceneRail } = load('../lib/conference-scene.ts');
for (const count of [1,3,8]) {
 const rail=sceneRail(1800,560,count,.76,false);
 assert(Math.abs(rail.tileWidth/rail.tileHeight-16/9)<.0001,'right thumbnails must preserve 16:9, even with only one participant');
 assert(rail.tileHeight<300,'a lone right participant must not stretch to stage height');
 assert.equal(rail.tileHeight,sceneRail(1800,560,1,.76,false).tileHeight,'roster count must not resize thumbnails');
 assert(rail.height>=560);
}
const portraitRail=sceneRail(360,650,6,.76,true);
assert(portraitRail.tileHeight<=144,'portrait participants form a compact horizontal strip');
assert(Math.abs(portraitRail.tileWidth/portraitRail.tileHeight-16/9)<.0001);
assert(sceneRail(1800,560,8,.76,false).height>560,'many participants scroll instead of compressing');
assert(sceneRail(1800,560,1,.88,false).tileWidth<sceneRail(1800,560,1,.76,false).tileWidth,'divider still changes participant allocation');
console.log('PASS scene rail: compact proportional tiles, independent of roster count, scrolling and resize');

assert.equal(portraitRail.mainHeight+12+portraitRail.tileHeight+16,650,'portrait rows include both 8px grid gaps');
