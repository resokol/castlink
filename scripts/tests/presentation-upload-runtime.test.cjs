const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
test('standalone body deadline allows 15 minute uploads while headers retain 60 second protection',()=>{
 require('../presentation-upload-runtime.cjs');
 const server=http.createServer();
 assert.equal(server.requestTimeout,15*60_000+30_000);
 assert.equal(server.headersTimeout,60_000);
 const listener=()=>{};assert.equal(http.createServer(listener).listeners('request')[0],listener);
 assert.equal(http.createServer({requestTimeout:123_000},listener).requestTimeout,123_000);
 assert.match(fs.readFileSync('scripts/prepare-web-runtime.mjs','utf8'),/presentation-upload-runtime.cjs/);
});
