'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const compiler = process.env.CC || 'cc';
const canCompile = process.platform !== 'win32' && spawnSync(compiler, ['--version']).status === 0;
const options = { name: 'CastLink Гость 1', width: 4, height: 4, fps: 25 };

// This independently authored C fixture checks the public NDI C ABI, not NDI networking.
// It deliberately reads every header field and all frame bytes on the native side.
function fixture(t, { failInit = false, failCreate = false, missingVideo = false } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'castlink-ndi-'));
  const outputs = [];
  t.after(async () => {
    for (const output of outputs) await output.stop();
    rmSync(directory, { recursive: true, force: true });
  });
  const log = path.join(directory, 'calls.log');
  const libraryPath = path.join(directory, process.platform === 'darwin' ? 'libndi.dylib' : 'libndi.so.6');
  const source = path.join(directory, 'fixture.c');
  writeFileSync(source, `
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
typedef struct { const char *name; const char *groups; bool video_clock; bool audio_clock; } Create;
typedef struct { int width, height, fourcc, rate_n, rate_d; float aspect; int format;
  int64_t timecode; const unsigned char *data; int stride; const char *metadata; int64_t timestamp; } Video;
typedef struct { int rate, channels, samples; int64_t timecode; int reference; const unsigned char *data; } Audio;
static FILE *record(void) { return fopen(${JSON.stringify(log)}, "a"); }
static void bytes(FILE *f, const unsigned char *p, int length) {
  for (int i = 0; i < length; i++) fprintf(f, "%02x", p[i]);
  fprintf(f, "\\n");
}
bool NDIlib_initialize(void) { FILE *f = record(); fprintf(f, "init\\n"); fclose(f); return ${!failInit}; }
void NDIlib_destroy(void) { FILE *f = record(); fprintf(f, "destroy\\n"); fclose(f); }
void *NDIlib_send_create(const Create *c) {
  FILE *f = record(); fprintf(f, "create %s %d %d %d\\n", c->name, c->groups == NULL, c->video_clock, c->audio_clock);
  fclose(f); return ${failCreate ? 'NULL' : 'malloc(1)'};
}
void NDIlib_send_destroy(void *p) { FILE *f = record(); fprintf(f, "stop\\n"); fclose(f); free(p); }
${missingVideo ? '' : `void NDIlib_send_send_video_v2(void *p, const Video *v) {
  FILE *f = record(); fprintf(f, "video %d %d %08x %d %d %.5f %d %lld %d %d %lld ",
    v->width, v->height, v->fourcc, v->rate_n, v->rate_d, v->aspect, v->format,
    (long long)v->timecode, v->stride, v->metadata == NULL, (long long)v->timestamp);
  bytes(f, v->data, v->width * v->height * 3 / 2); fclose(f);
}`}
void NDIlib_util_send_send_audio_interleaved_16s(void *p, const Audio *a) {
  FILE *f = record(); fprintf(f, "audio %d %d %d %lld %d ",
    a->rate, a->channels, a->samples, (long long)a->timecode, a->reference);
  bytes(f, a->data, a->channels * a->samples * 2); fclose(f);
}
`);
  const compiled = spawnSync(compiler, [process.platform === 'darwin' ? '-dynamiclib' : '-shared', '-fPIC', source, '-o', libraryPath], { encoding: 'utf8' });
  assert.equal(compiled.status, 0, compiled.stderr);
  return {
    directory, libraryPath,
    async start(args) {
      const output = await require('../src/vmix-ndi-output.cjs').startNdiOutput({ libraryPath, ...args });
      outputs.push(output);
      return output;
    },
    lines: () => { try { return readFileSync(log, 'utf8').trim().split('\n'); } catch { return []; } },
  };
}

test('NDI passes packed I420 and signed interleaved stereo bytes through the native C ABI', { skip: !canCompile }, async t => {
  const native = fixture(t);
  const output = await native.start(options);
  const video = Buffer.from(Array.from({ length: 24 }, (_, index) => index));
  const audio = Buffer.from('0080ff7f0000ffff', 'hex');
  assert.equal(output.writeVideo(video), true);
  assert.equal(output.writeAudio(audio), true);
  assert.deepEqual(native.lines(), [
    'init', 'create CastLink Гость 1 1 0 0',
    'video 4 4 30323449 25 1 1.00000 1 9223372036854775807 4 1 0 000102030405060708090a0b0c0d0e0f1011121314151617',
    'audio 48000 2 2 9223372036854775807 0 0080ff7f0000ffff',
  ]);
  await output.stop();
  await output.stop();
  assert.deepEqual(await output.closed, { code: 0, signal: null });
  assert.equal(output.writeVideo(video), false);
  assert.equal(output.writeAudio(audio), false);
  assert.deepEqual(native.lines().slice(-2), ['stop', 'destroy']);
});

test('NDI validates encoding and source names before opening a native library', async () => {
  const { startNdiOutput } = require('../src/vmix-ndi-output.cjs');
  for (const invalid of [
    { width: 3 }, { height: 0 }, { height: 4098 }, { fps: 0 }, { fps: 121 }, { fps: 29.97 },
  ]) {
    await assert.rejects(startNdiOutput({ ...options, ...invalid, libraryPath: '/missing/ndi' }), { code: 'NDI_ENCODING' });
  }
  for (const name of ['', ' ', 'a\0b', 'a\nb', 'a/b', 'a:b', 'x'.repeat(254)]) {
    await assert.rejects(startNdiOutput({ ...options, name, libraryPath: '/missing/ndi' }), { code: 'NDI_NAME' });
  }
  await assert.rejects(startNdiOutput({ ...options, libraryPath: 'relative.dll' }), { code: 'NDI_LIBRARY_PATH' });
  await assert.rejects(startNdiOutput({ ...options, libraryPath: '/missing/ndi' }), { code: 'NDI_RUNTIME_UNAVAILABLE' });
});

test('NDI drops malformed buffers without passing unsafe pointers to the runtime', { skip: !canCompile }, async t => {
  const native = fixture(t);
  const output = await native.start(options);
  for (const value of [Buffer.alloc(25), null, new Uint8Array(24), Buffer.alloc(0), Buffer.alloc(23)]) {
    assert.equal(output.writeVideo(value), false);
  }
  for (const value of [Buffer.alloc(192_004), null, new Uint8Array(8), Buffer.alloc(0), Buffer.alloc(3), Buffer.alloc(5)]) {
    assert.equal(output.writeAudio(value), false);
  }
  assert.deepEqual(native.lines(), ['init', 'create CastLink Гость 1 1 0 0']);
});

test('NDI keeps its runtime initialized until all persistent slot senders stop', { skip: !canCompile }, async t => {
  const native = fixture(t);
  const first = await native.start(options);
  const second = await native.start({ ...options, name: 'CastLink Slot 2' });
  assert.equal(native.lines().filter(line => line === 'init').length, 1);
  await first.stop();
  assert.equal(native.lines().includes('destroy'), false);
  assert.equal(second.writeVideo(Buffer.alloc(24)), true);
  await second.stop();
  assert.equal(native.lines().filter(line => line === 'stop').length, 2);
  assert.equal(native.lines().filter(line => line === 'destroy').length, 1);
});

test('NDI initialization, missing ABI, and sender creation failures release acquired resources', { skip: !canCompile }, async t => {
  for (const [flags, code, calls] of [
    [{ failInit: true }, 'NDI_INITIALIZE', ['init']],
    [{ missingVideo: true }, 'NDI_RUNTIME_UNAVAILABLE', []],
    [{ failCreate: true }, 'NDI_SENDER_UNAVAILABLE', ['init', 'create CastLink Гость 1 1 0 0', 'destroy']],
  ]) {
    const native = fixture(t, flags);
    await assert.rejects(native.start(options), { code });
    assert.deepEqual(native.lines(), calls);
  }
});

test('NDI locates the separately installed runtime from NDI_RUNTIME_DIR_V6', { skip: !canCompile }, async t => {
  const native = fixture(t);
  const previous = process.env.NDI_RUNTIME_DIR_V6;
  process.env.NDI_RUNTIME_DIR_V6 = native.directory;
  t.after(() => {
    if (previous === undefined) delete process.env.NDI_RUNTIME_DIR_V6;
    else process.env.NDI_RUNTIME_DIR_V6 = previous;
  });
  const output = await native.start({ ...options, libraryPath: undefined });
  assert.equal(output.writeVideo(Buffer.alloc(24)), true);
  await output.stop();
  assert.deepEqual(native.lines().slice(-2), ['stop', 'destroy']);
});
