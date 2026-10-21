import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
test('each CastLink build stage explicitly marks ownership, full source and stage without marking stock bases',()=>{
  for(const [file,stages] of [['Dockerfile.web',['web-builder','web-runtime']],['infrastructure/turn-tls/Dockerfile',['turntls-runtime']]]){
    const source=fs.readFileSync(path.join(root,file),'utf8');
    const bodies=source.split(/^FROM .+$/m).slice(1);
    assert.equal(bodies.length,stages.length);
    bodies.forEach((body,i)=>{
      assert.match(body,/ARG CASTLINK_SOURCE_COMMIT/);
      assert.match(body,/ru\.castlink\.image\.owner="castlink"/);
      assert.match(body,/ru\.castlink\.image\.ownership="castlink-build-v1"/);
      assert.match(body,/ru\.castlink\.image\.source="\$\{CASTLINK_SOURCE_COMMIT\}"/);
      assert.ok(body.includes(`ru.castlink.image.stage="${stages[i]}"`));
      assert.ok(body.indexOf('ru.castlink.image.ownership') < body.search(/^RUN /m),'mark own intermediate images before build instructions');
    });
  }
});
test('official producer passes the exact source commit to both own Docker builds',()=>{
  const producer=fs.readFileSync(path.join(root,'scripts/build-simple-easy-setup-images.mjs'),'utf8');
  assert.equal((producer.match(/CASTLINK_SOURCE_COMMIT=\$\{commit\}/g)||[]).length,2);
  assert.ok(producer.includes("docker(['tag',reference,tags[name]])"),'stock images remain aliases without own-build labels');
});
