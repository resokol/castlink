const assert = require('node:assert/strict');
const {load} = require('./load-typescript.cjs');
let links;
try { links = load('../lib/entry-links.ts', {}); } catch(e) { assert.fail('entry links must provide validated invite and native handoff helpers: '+e.message); }
const {parseGuestInviteUrl, nativeInviteUrl, isCastLinkDesktop} = links;
for (const input of ['javascript:alert(1)','https://user:password@example.com/join#invite=secret','http://example.com/join#invite=secret','https://example.com/admin#invite=secret','https://example.com/join','https://example.com/#invite=secret','https://example.com/join?invite=','https://example.com/join#invite='+ 'x'.repeat(4097)]) assert.equal(parseGuestInviteUrl(input),null,input.slice(0,80));
const original='https://example.com/join?studioId=one#invite=opaque-key';
assert.equal(parseGuestInviteUrl(original).href,original);
assert.equal(parseGuestInviteUrl(original).personal,true);
const legacy=parseGuestInviteUrl('https://example.com/?name=Evening&mode=guest&invite=legacy-key');
assert.equal(legacy.personal,false);assert.equal(legacy.room,'Evening');assert.equal(new URL(legacy.href).searchParams.has('invite'),false);assert.equal(new URLSearchParams(new URL(legacy.href).hash.slice(1)).get('invite'),'legacy-key');
assert.equal(parseGuestInviteUrl('http://localhost:3000/join#invite=local').invite,'local');
const native=new URL(nativeInviteUrl(original));assert.equal(native.protocol,'castlink:');assert.equal(native.hostname,'join');assert.equal(native.searchParams.get('url'),original);assert.equal(native.searchParams.size,1);
assert.equal(nativeInviteUrl('https://example.com/admin'),null);
assert.equal(isCastLinkDesktop('Mozilla/5.0 CastLinkDesktop/1',false),true);assert.equal(isCastLinkDesktop('Mozilla/5.0',true),true);assert.equal(isCastLinkDesktop('Mozilla/5.0',false),false);
console.log('PASS entry links: HTTPS validation, legacy canonicalization, exact opaque invite handoff and native-loop prevention');
assert.equal(nativeInviteUrl('https://example.com/join#invite='+encodeURIComponent('Я'.repeat(1500))),null,'native destination shares desktop 8192-byte limit');
assert.equal(nativeInviteUrl('http://localhost:3000/join#invite=local'),null,'packaged native handoff requires HTTPS even when web supports loopback dev');
assert.equal(links.openNativeInvite(original,()=>{throw Error('protocol denied');}),false,'blocked protocol launch must preserve browser fallback');
let dispatched='';assert.equal(links.openNativeInvite(original,target=>{dispatched=target;}),true);assert.equal(new URL(dispatched).searchParams.get('url'),original);

for (const [browser, expected] of [
  [{userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',platform:'Win32',maxTouchPoints:0},'windows'],
  [{userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',platform:'Win32',maxTouchPoints:10},'windows'],
  [{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',platform:'MacIntel',maxTouchPoints:0},'macos'],
  [{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0 Safari/537.36',platform:'MacIntel',maxTouchPoints:0},'macos'],
  [{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:130.0) Gecko/20100101 Firefox/130.0'},'macos'],
  [{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',platform:'iPhone',maxTouchPoints:5},null],
  [{userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)',platform:'iPad',maxTouchPoints:5},null],
  [{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',platform:'MacIntel',maxTouchPoints:5},null],
  [{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Mobile/15E148 Safari/604.1',platform:'MacIntel'},null],
  [{userAgent:'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'},null],
  [{userAgent:'Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/130.0',platform:'Linux x86_64'},null],
  [{userAgent:''},null],
]) assert.equal(links.entryDesktopPlatform(browser),expected,JSON.stringify(browser));
console.log('PASS entry desktop platform: Windows touch devices and Mac Safari/Chromium/Firefox supported; mobile and iPad desktop masquerade excluded');
