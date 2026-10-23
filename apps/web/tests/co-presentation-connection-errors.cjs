const assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs');
const api=load('../lib/co-presentation-native.ts');
assert.equal(typeof api.nativeConnectionFailure,'function','connection failures expose finite safe stage/code diagnostics');
for(const locale of ['ru','en','zh-CN']) {
  const actual=api.nativeConnectionFailure(locale,'native',{code:'POWERPOINT_COM_UNAVAILABLE',message:'SECRET C:\\Private\\deck.pptx TOKEN'});
  assert.match(actual,/native:POWERPOINT_COM_UNAVAILABLE/);
  assert.doesNotMatch(actual,/SECRET|Private|TOKEN/,'never leak native message/path/token');
  const unknown=api.nativeConnectionFailure(locale,'native',{code:'SECRET_TOKEN',message:'private'});
  assert.match(unknown,/native:POWERPOINT_UNAVAILABLE/); assert.doesNotMatch(unknown,/SECRET|private/);
  assert.match(api.nativeConnectionFailure(locale,'server-create',{status:403,message:'private'}),/server-create:HTTP_403/);
  assert.match(api.nativeConnectionFailure(locale,'native-response',new Error('secret')) ,/native-response:INVALID_RESPONSE/);
}
assert.match(api.nativeConnectionFailure('ru','bridge'),/Обновите клиент ведущего/);
assert.match(api.nativeConnectionFailure('ru','native',{code:'POWERPOINT_SOURCE_MISMATCH'}),/Выберите окно показа PowerPoint/);
assert.match(api.nativeConnectionFailure('ru','native',{code:'POWERPOINT_NO_SLIDESHOW'}),/Запустите показ/);
assert.doesNotMatch(api.nativeConnectionFailure('ru','native',{code:'POWERPOINT_COM_UNAVAILABLE'}),/Запустите показ|Обновите клиент/);
assert.match(api.nativeConnectionFailure('ru','native',{code:'POWERPOINT_AMBIGUOUS'}),/Оставьте один запущенный показ.*точное окно.*клиент/);
assert.match(api.nativeConnectionFailure('en','native',{code:'POWERPOINT_AMBIGUOUS'}),/one running slideshow.*client.*exact window/);
assert.match(api.nativeConnectionFailure('zh-CN','native',{code:'POWERPOINT_AMBIGUOUS'}),/一个.*客户端.*准确窗口/);
assert.equal(api.sharedPowerPointBridge({}),undefined);
const bridge={version:4,connect(){},status(){},goTo(){},disconnect(){},connectShared(){},step(){}};
assert.equal(api.sharedPowerPointBridge({castlinkDesktop:{version:1,powerPoint:bridge}}),bridge);
assert.equal(api.sharedPowerPointBridge({castlinkDesktop:{version:1,powerPoint:{...bridge,version:3}}}),undefined);
assert.equal(api.sharedPowerPointBridge({castlinkDesktop:{version:1,powerPoint:{...bridge,step:undefined}}}),undefined,'animation step is mandatory');
assert.equal(api.nativeCaptureId({mediaStreamTrack:{castlinkCaptureId:'10000000-0000-4000-8000-000000000001'}}),'10000000-0000-4000-8000-000000000001');
assert.equal(api.nativeCaptureId({mediaStreamTrack:{castlinkCaptureId:'window:123:0'}}),undefined,'renderer never supplies window HWND');
console.log('PASS safe native connection stages/codes, no raw messages, v4 step/source capability and opaque capture id');
