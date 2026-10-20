const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const { conferenceGalleryLayout } = load('../lib/conference-gallery-layout.ts');
for (const [count, width, height, columns, rows] of [[1,1400,800,1,1],[2,1400,800,1,2],[3,1400,800,2,2],[3,1400,350,3,1],[6,1400,800,2,3],[8,1400,800,3,3],[3,350,650,1,3]]) {
  assert.deepEqual(conferenceGalleryLayout(count,width,height),{columns,rows}, `${count} frames in ${width}x${height}`);
}
for (const count of [1,2,3,4,5,6,8,9,12,20]) for(const [width,height] of [[1440,760],[780,980],[350,500]]) {
  const fit = conferenceGalleryLayout(count,width,height);
  const size = columns => { const rows=Math.ceil(count/columns); return Math.min((width-12*(columns-1))/columns,(height-12*(rows-1))/rows*16/9); };
  for(let columns=1;columns<=count;columns++) assert(size(fit.columns)>=size(columns)-.001,'no alternative fits larger equal frames');
  assert(fit.columns*fit.rows>=count,'every participant fits');
}
console.log('PASS maximum equal 16:9 gallery size across measured landscape/portrait stages');
