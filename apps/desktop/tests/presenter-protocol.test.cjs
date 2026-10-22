'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict');
const{parsePresenterLaunch,isPresenterLaunch}=require('../src/presenter-protocol.cjs');
const code='cp2_'+'x'.repeat(43),uri='castlink-presenter://connect?server='+encodeURIComponent('https://castlink.ru')+'#'+code;
test('presenter accepts only distinct protocol, exact HTTPS origin and opaque one-use ticket fragment',()=>{
 assert.deepEqual(parsePresenterLaunch(uri),{server:'https://castlink.ru',code});
 assert.equal(isPresenterLaunch(uri),true);assert.equal(isPresenterLaunch('castlink://join?url=x'),false);
 for(const value of [uri.replace('connect','other'),uri.replace('#','?ticket='),uri+'&other=x',
  uri.replace(encodeURIComponent('https://castlink.ru'),encodeURIComponent('http://castlink.ru')),
  uri.replace(encodeURIComponent('https://castlink.ru'),encodeURIComponent('https://u:p@castlink.ru')),
  uri.replace(encodeURIComponent('https://castlink.ru'),encodeURIComponent('https://castlink.ru/path')),
  uri.replace('server=','other='),uri.replace('?server=','?server=x&server='),uri.replace(code,'guest-jwt'),
  uri.replace('connect?','connect/other?'),uri+'\n','castlink-presenter://connect?server=x#'+code]){
  assert.throws(()=>parsePresenterLaunch(value),/Invalid presenter link/);
 }
});
