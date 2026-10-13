import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
test('TURN TLS helper rejects injected hostnames before accessing certificates',()=>{
 const result=execFileSync('sh',['-c','CASTLINK_TURN_HOST="turn.example.com;touch /tmp/castlink-turn-injected" sh infrastructure/turn-tls/entrypoint.sh check 2>&1; test ! -e /tmp/castlink-turn-injected'],{encoding:'utf8'});
 assert.match(result,/Invalid TURN domain/);
});
test('TURN TLS image reads Caddy storage only and validates certificate identity before reload',()=>{
 const helper=fs.readFileSync('infrastructure/turn-tls/entrypoint.sh','utf8');
 assert.match(helper,/-checkhost/);assert.match(helper,/-checkend/);
 assert.match(helper,/openssl verify/);assert.match(helper,/send-proxy-v2/);
 assert.match(helper,/accept-proxy/);assert.match(helper,/kill -USR2/);
 assert.match(helper,/server caddy caddy:8443[^\n]*send-proxy-v2/);
 assert.match(helper,/use_backend turn_entry if \{ req\.ssl_hello_type 1 \} !\{ req\.ssl_sni -m found \} !\{ req\.ssl_alpn -m found \}/);
 assert.doesNotMatch(helper,/livekit.*restart|docker (exec|restart|run)/);
});
