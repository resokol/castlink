const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./load-typescript.cjs');
const { RecipientSlideControls } = load('../components/RecipientSlideControls.tsx');

const session = {
  id: 's', generation: 'g', controlRevision: 2, owner: {identity: 'host', sid: 'h'},
  controller: {identity: 'guest', sid: 'r'}, name: 'Slides', kind: 'window',
  navigationMode: 'window-steps-v1', revision: 1, renderedRevision: 1,
};
for (const [locale, release, approval] of [
  ['ru', 'Отказаться от управления', /Принять управление|Отклонить/],
  ['en', 'Release controls', /Accept controls|Decline/],
  ['zh-CN', '放弃控制', /接受控制|拒绝/],
]) {
  const html = renderToStaticMarkup(React.createElement(RecipientSlideControls, {
    id: 'recipient', sessions: [session], locale, busy: false, unavailable: false,
    reopen: 0, action() {}, onRelease() {},
  }));
  assert.ok(html.includes(release), 'recipient can voluntarily release the grant');
  assert.doesNotMatch(html, approval);
  assert.doesNotMatch(html, /disabled=""/, 'current shared window can be navigated immediately');
}
console.log('PASS recipients can navigate immediately or release the grant in each locale');
