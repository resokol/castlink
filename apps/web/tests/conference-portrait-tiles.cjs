const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const { sceneGallery } = load('../lib/conference-scene.ts');

// Portrait Tiles is a readable two-column gallery, even when another arrangement
// could fill more vertical space. Extra guests scroll instead of shrinking.
for (const width of [280, 350, 414, 680]) for (const count of [2, 3, 4, 7, 20]) {
  const fit = sceneGallery(count, width, 500, true);
  assert.equal(fit.columns, 2, `${count} portrait sources in ${width}px use two columns`);
  assert.equal(fit.rows, Math.ceil(count / 2));
  assert.equal(fit.tileWidth, (width - 8) / 2);
  assert.equal(fit.tileHeight, fit.tileWidth * 9 / 16);
  assert.deepEqual(sceneGallery(count, width, 180, true), fit, 'shorter stages scroll without compressing the tiles');
}
const many = sceneGallery(20, 350, 300, true);
assert(many.rows * many.tileHeight + (many.rows - 1) * 8 > 300, 'large rosters need vertical scrolling');
assert.equal(sceneGallery(1, 350, 500, true).columns, 1, 'a single source keeps its full width');
assert.deepEqual(sceneGallery(3, 350, 650), sceneGallery(3, 350, 650, false), 'desktop policy remains the default');
assert.equal(sceneGallery(3, 350, 650).columns, 1, 'desktop uses the original maximum-frame algorithm');
console.log('PASS portrait Tiles: two equal 16:9 columns, stable readable size, scroll overflow, unchanged desktop policy');
