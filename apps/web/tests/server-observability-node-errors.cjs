const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { load } = require('./load-typescript.cjs');
const { ServerObservabilityStore } = load('../lib/server-observability-store.ts');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-error-semantics-'));
try {
  for (const framework of [false, true]) {
    const data = path.join(directory, framework ? 'framework' : 'standalone');
    const code = `
      process.env.STUDIOLINK_DATA_DIR=${JSON.stringify(data)};
      const {load}=require(${JSON.stringify(path.join(__dirname, 'load-typescript.cjs'))});
      const framework=()=>{};
      if(${framework}) process.on('unhandledRejection',framework);
      const worker=load('../lib/server-observability-worker.ts',{'./server-monitor':{collectServerMonitorSample:()=>new Promise(()=>{})},'./server-log':{serverLog(){}}});
      worker.startServerObservability();
      Promise.reject(new Error('sensitive-message-one'));
      if(${framework}) {
        Promise.reject(new Error('sensitive-message-two'));
        setTimeout(()=>{process.removeListener('unhandledRejection',framework);Promise.reject(new Error('sensitive-final-message'));},20);
      }
    `;
    const child = spawnSync(process.execPath, ['--unhandled-rejections=throw', '-e', code], { encoding: 'utf8', timeout: 10000 });
    assert.equal(child.error, undefined, child.error?.message);
    assert.equal(child.status, 1, 'default unhandled rejection remains fatal when no framework handler exists');
    const store = new ServerObservabilityStore(path.join(data, 'runtime', 'server-observability.sqlite'));
    const events = store.readEvents('error').events;
    assert.equal(events.filter(event => event.event === 'server.uncaught_exception').length, 1);
    assert.equal(events.filter(event => event.event === 'server.unhandled_rejection').length, framework ? 2 : 0);
    assert.doesNotMatch(JSON.stringify(events), /sensitive-message|sensitive-final|stack/);
    store.close();
  }
  console.log('PASS: actual child processes preserve default fatal rejection exit and retain both framework errors before handler removal');
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
