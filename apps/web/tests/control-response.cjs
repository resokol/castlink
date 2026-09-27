const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');

Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);

const { readControlResponse } = require('../lib/control-response.ts');

(async () => {
  assert.deepEqual(await readControlResponse(new Response('{"revision":4}', { status: 200 }), 'Ошибка'), { revision: 4 });
  await assert.rejects(readControlResponse(new Response('', { status: 502 }), 'Не удалось проверить управление'), /Не удалось проверить управление \(HTTP 502\)/);
  await assert.rejects(readControlResponse(new Response('', { status: 200 }), 'Ошибка'), /пустой или некорректный ответ \(HTTP 200\)/);
  await assert.rejects(readControlResponse(new Response('<html>proxy error</html>', { status: 503 }), 'Не удалось проверить управление'), /Не удалось проверить управление \(HTTP 503\)/);
  await assert.rejects(readControlResponse(new Response('{"error":"Состояние изменилось"}', { status: 409 }), 'Ошибка'), /Состояние изменилось/);
  await assert.rejects(readControlResponse(new Response('null', { status: 200 }), 'Ошибка'), /пустой или некорректный ответ/);
  await assert.rejects(readControlResponse(new Response('{broken', { status: 200 }), 'Ошибка'), /пустой или некорректный ответ/);
  console.log('PASS: Studio Control response parser handles valid, empty, malformed, non-JSON, and API-error responses');
})().catch(error => { console.error(error); process.exitCode = 1; });
