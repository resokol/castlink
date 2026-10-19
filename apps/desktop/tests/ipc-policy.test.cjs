const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validScreenState, isClientEvent } = require('../src/ipc-policy.cjs');
const value = { captureId:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',sharing:true,visible:true,stopping:false,failed:false,locale:'ru',labels:{title:'Panel',stop:'STOP',stopping:'Stopping',stopError:'Retry'} };
test('IPC rejects malformed, oversized and arbitrary-command payloads', () => {
  assert.equal(validScreenState(value), true);
  for(const change of [{captureId:'bad'},{sharing:'yes'},{locale:'bad'},{labels:{...value.labels,stop:'x'.repeat(241)}},{command:'exec'},{visible:'yes'}]) assert.equal(validScreenState({...value,...change}), false);
});
test('only current trusted main webContents/frame can update the panel', () => {
  const frame={url:'https://studio.example/room'}, contents={mainFrame:frame}, client={webContents:contents,isDestroyed:()=>false};
  const event={sender:contents,senderFrame:frame}, trustedOrigins=new Set(['https://studio.example']);
  assert.equal(isClientEvent(event,client,trustedOrigins),true);
  assert.equal(isClientEvent({...event,sender:{}},client,trustedOrigins),false);
  assert.equal(isClientEvent({...event,senderFrame:{url:frame.url}},client,trustedOrigins),false);
  frame.url='https://evil.example';assert.equal(isClientEvent(event,client,trustedOrigins),false);
});
