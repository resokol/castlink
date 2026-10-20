'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const policy=require('../src/server-policy.cjs');
const wrap=url=>'castlink://join?url='+encodeURIComponent(url);
test('native invitation decoding preserves full route and secret without persisting it',()=>{
  const target='https://studio.example/room?name=Show&mode=guest#invite=private%2Btoken';
  const parsed=policy.parseDeepLink(wrap(target));
  assert.equal(parsed.launchUrl,target);
  assert.deepEqual(policy.settingsForDisk(parsed,[],'ru'),{serverOrigin:'https://studio.example',reserveOrigins:[],locale:'ru'});
});
test('native protocol accepts only exact join envelope and trusted HTTPS destination syntax',()=>{
  const bad=['https://studio.example','castlink://other?url='+encodeURIComponent('https://studio.example'),wrap('javascript:alert(1)'),wrap('file:///tmp/a'),wrap('https://user:pass@studio.example'),wrap('http://192.168.0.2'),wrap('http://localhost:3000'),'castlink://join/path?url=https%3A%2F%2Fstudio.example','castlink://join?url=https%3A%2F%2Fstudio.example&url=https%3A%2F%2Fevil.example','castlink://join?url=https%3A%2F%2Fstudio.example&other=1','castlink://join?url=https%3A%2F%2Fstudio.example#secret',wrap('castlink://join?url=foo')];
  for(const input of bad)assert.throws(()=>policy.parseDeepLink(input),/Invalid invitation|HTTPS required/,input);
  assert.equal(policy.parseDeepLink(wrap('http://127.0.0.1:3000/room'),true).origin,'http://127.0.0.1:3000');
});
