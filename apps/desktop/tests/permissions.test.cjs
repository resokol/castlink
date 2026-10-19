const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPermissionPolicy } = require('../src/permissions.cjs');
const trusted = { frameUrl: 'https://studio.example/room', isMainFrame: true };
test('media requires native consent and never grants unknown permissions', async () => {
  let prompts = 0;
  const policy = createPermissionPolicy({ trustedOrigins: new Set(['https://studio.example']), ask: async () => { prompts++; return true; } });
  assert.equal(policy.check({ ...trusted, permission: 'media', mediaTypes: ['audio'] }), false);
  assert.equal(await policy.request({ ...trusted, permission: 'media', mediaTypes: ['audio'] }), true);
  assert.equal(policy.check({ ...trusted, permission: 'media', mediaTypes: ['audio'] }), true);
  assert.equal(policy.check({ ...trusted, permission: 'media', mediaTypes: ['video'] }), false);
  assert.equal(await policy.request({ ...trusted, permission: 'clipboard-read' }), false);
  assert.equal(await policy.request({ ...trusted, permission: 'media', mediaTypes: ['audio'], isMainFrame: false }), false);
  assert.equal(await policy.request({ ...trusted, permission: 'media', mediaTypes: ['audio'], frameUrl: 'https://evil.example' }), false);
  assert.equal(prompts, 1);
});
test('navigation invalidates pending consent and clears grants', async () => {
  let decide;
  const policy = createPermissionPolicy({ trustedOrigins: new Set(['https://studio.example']), ask: () => new Promise(r => decide = r) });
  const pending = policy.request({ ...trusted, permission: 'media', mediaTypes: ['video'] });
  policy.reset(); decide(true);
  assert.equal(await pending, false);
  assert.equal(policy.check({ ...trusted, permission: 'media', mediaTypes: ['video'] }), false);
});
test('denial and empty/unknown media types cannot grant capture', async () => {
  const policy = createPermissionPolicy({ trustedOrigins: new Set(['https://studio.example']), ask: async () => false });
  assert.equal(await policy.request({ ...trusted, permission: 'media', mediaTypes: ['audio'] }), false);
  assert.equal(await policy.request({ ...trusted, permission: 'media', mediaTypes: [] }), false);
  assert.equal(await policy.request({ ...trusted, permission: 'media', mediaTypes: ['unknown'] }), false);
});
test('Electron getDisplayMedia empty mediaTypes receives display-only consent', async () => {
  const policy = createPermissionPolicy({ trustedOrigins: new Set(['https://studio.example']), ask: async () => true });
  assert.equal(await policy.request({ ...trusted, permission: 'media', mediaTypes: [] }), true);
  assert.equal(policy.check({ ...trusted, permission: 'display-capture' }), true);
  assert.equal(policy.check({ ...trusted, permission: 'media', mediaTypes: ['audio'] }), false);
  assert.equal(policy.check({ ...trusted, permission: 'media', mediaTypes: ['video'] }), false);
  assert.equal(await policy.request({ ...trusted, permission: 'media', mediaTypes: ['unknown'] }), false);
  assert.equal(await policy.request({ ...trusted, permission: 'media' }), false);
});

test('clipboard write works for the trusted main frame without clipboard read access', async () => {
  let prompts = 0;
  const policy = createPermissionPolicy({trustedOrigins:new Set(['https://studio.example']),ask:async()=>{prompts++;return true;}});
  for (const action of ['check','request']) {
    assert.equal(await policy[action]({...trusted,permission:'clipboard-sanitized-write'}),true);
    for (const permission of ['clipboard-read','deprecated-sync-clipboard-read']) assert.equal(await policy[action]({...trusted,permission}),false);
    assert.equal(await policy[action]({...trusted,permission:'clipboard-sanitized-write',isMainFrame:false}),false);
    assert.equal(await policy[action]({...trusted,permission:'clipboard-sanitized-write',frameUrl:'https://evil.example'}),false);
  }
  assert.equal(prompts,0);
});
test('device inventory checks use input consent rather than screen-capture consent', async () => {
  const policy=createPermissionPolicy({trustedOrigins:new Set(['https://studio.example']),ask:async()=>true});
  const inventory={...trusted,permission:'media'};
  assert.equal(policy.check(inventory),false);
  await policy.request({...trusted,permission:'media',mediaTypes:[]});
  assert.equal(policy.check(inventory),false,'screen access never reveals microphone/camera inventory');
  await policy.request({...trusted,permission:'media',mediaTypes:['audio']});
  assert.equal(policy.check(inventory),true,'Electron enumerateDevices has no mediaType');
  assert.equal(policy.check({...inventory,mediaTypes:['unknown']}),true);
  assert.equal(policy.check({...inventory,mediaTypes:['video']}),false);
  assert.equal(policy.check({...trusted,permission:'speaker-selection'}),true);
  assert.equal(policy.check({...inventory,isMainFrame:false}),false);
  policy.reset(); assert.equal(policy.check(inventory),false);
});

test('same-origin navigation retains consent but cancels pending decisions; full reset revokes it',async()=>{
  let decide;
  const policy=createPermissionPolicy({trustedOrigins:new Set(['https://studio.example']),ask:()=>new Promise(r=>decide=r)});
  const audio={...trusted,permission:'media',mediaTypes:['audio']};
  let pending=policy.request(audio);decide(true);await pending;
  pending=policy.request({...audio,mediaTypes:['video']});
  policy.reset({keepGrants:true});decide(true);
  assert.equal(await pending,false);
  assert.equal(policy.check(audio),true);
  assert.equal(policy.check({...audio,mediaTypes:['video']}),false);
  policy.reset();assert.equal(policy.check(audio),false);
});
