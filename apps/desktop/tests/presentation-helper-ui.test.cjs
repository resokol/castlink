'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('helper local form protects pairing code and names actual states in three languages',()=>{
 const base=path.join(__dirname,'../ui/presentation-helper');
 assert.ok(fs.existsSync(base+'.html'),'helper local page exists');
 const html=fs.readFileSync(base+'.html','utf8'),js=fs.readFileSync(base+'.js','utf8'),css=fs.readFileSync(base+'.css','utf8');
 assert.match(html,/type="password"/);assert.match(html,/autocomplete="off"/);assert.match(html,/aria-live="polite"/);
 assert.doesNotMatch(js,/localStorage|sessionStorage|innerHTML|console\.|https:\/\/castlink\.ru/);
 for(const text of ['connected','revoked','error','disconnected',"'ru'","'en'","'zh-CN'"])assert.ok(js.includes(text),text);
 assert.match(css,/focus-visible/);assert.match(css,/data-theme=light/);
});
