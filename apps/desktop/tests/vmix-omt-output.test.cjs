'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// A separately compiled C consumer checks the actual FFI ABI, pixel order,
// audio planes and lifetime. This is not an OMT receiver/interoperability test.
const fixtureSource = `
#include <stdint.h>
#include <stdatomic.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
typedef struct {
  int Type; int64_t Timestamp; int Codec;
  int Width, Height, Stride, Flags, FrameRateN, FrameRateD;
  float AspectRatio; int ColorSpace, SampleRate, Channels, SamplesPerChannel;
  void *Data; int DataLength; void *CompressedData; int CompressedLength;
  void *FrameMetadata; int FrameMetadataLength;
} OMTMediaFrame;
typedef struct { int id; char name[1024]; } Sender;
static OMTMediaFrame video, audio;
static unsigned char pixels[1048576], samples[1048576];
static int creates, destroys, destroyed_while_active, video_calls, audio_calls;
static _Atomic int active, clean;
static int quality;
static char name[1024];
void *omt_send_create(const char *value, int q) {
  if (!strcmp(value, "__create_fail")) return NULL;
  Sender *s = calloc(1, sizeof(Sender));
  s->id = ++creates; strncpy(s->name, value, 1023);
  strncpy(name, value, 1023); quality = q; return s;
}
int omt_send(void *instance, OMTMediaFrame *f) {
  active++;
  usleep(40000);
  clean = f->Flags == 0 && f->CompressedData == NULL && f->CompressedLength == 0
    && f->FrameMetadata == NULL && f->FrameMetadataLength == 0;
  if (f->Type == 2) { video = *f; memcpy(pixels, f->Data, f->DataLength); video_calls++; }
  if (f->Type == 4) { audio = *f; memcpy(samples, f->Data, f->DataLength); audio_calls++; }
  active--;
  return strcmp(((Sender *)instance)->name, "__send_zero") ? f->DataLength : 0;
}
void omt_send_destroy(void *instance) { destroyed_while_active += active; destroys++; free(instance); }
int fixture_value(int field) {
  switch (field) {
    case 0: return video.Width; case 1: return video.Height; case 2: return video.Stride;
    case 3: return video.Codec; case 4: return video.FrameRateN; case 5: return video.FrameRateD;
    case 6: return video.ColorSpace; case 7: return video.DataLength;
    case 8: return audio.SampleRate; case 9: return audio.Channels; case 10: return audio.SamplesPerChannel;
    case 11: return audio.Codec; case 12: return audio.DataLength; case 13: return quality;
    case 14: return creates; case 15: return destroys; case 16: return destroyed_while_active;
    case 17: return video_calls; case 18: return audio_calls; case 19: return clean;
  } return -999;
}
int fixture_pixel(int i) { return pixels[i]; }
float fixture_sample(int i) { float value; memcpy(&value, samples + i * 4, 4); return value; }
int64_t fixture_timestamp(int type) { return type == 2 ? video.Timestamp : audio.Timestamp; }
float fixture_aspect(void) { return video.AspectRatio; }
const char *fixture_name(void) { return name; }
`;

let startOmtOutput;
try { ({ startOmtOutput } = require('../src/vmix-omt-output.cjs')); }
catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }

test('native OMT output adapter is available without loading optional runtime', () => {
  assert.equal(typeof startOmtOutput, 'function');
});

test('OMT rejects invalid options before attempting native loading', async () => {
  for (const invalid of [{ width: 15 }, { width: 17 }, { height: 0 }, { fps: 0 }, { fps: 121 },
    { name: '' }, { name: 'bad\0name' }, { name: 'я'.repeat(512) }, { libraryPath: 'relative.dll' }]) {
    await assert.rejects(() => startOmtOutput({ libraryPath: '/missing/libomt.so', name: 'Slot 1', width: 16, height: 16, fps: 25, ...invalid }), /OMT_CONFIG/);
  }
  await assert.rejects(() => startOmtOutput({ libraryPath: '/missing/libomt.so', name: 'Slot 1', width: 16, height: 16, fps: 25 }), /OMT_RUNTIME_UNAVAILABLE/);
});

test('OMT C ABI receives NV12 video, float planar audio, bounded writes and safe stop', { skip: process.platform === 'win32', timeout: 10000 }, async t => {
  const compiler = process.env.CC || 'cc';
  if (spawnSync(compiler, ['--version']).status !== 0) { t.skip('C compiler unavailable'); return; }
  const directory = mkdtempSync(path.join(tmpdir(), 'castlink-omt-test-'));
  const sourcePath = path.join(directory, 'fixture.c');
  const libraryPath = path.join(directory, process.platform === 'darwin' ? 'libomt.dylib' : 'libomt.so');
  writeFileSync(sourcePath, fixtureSource);
  let output, second;
  try {
    const compiled = spawnSync(compiler, [process.platform === 'darwin' ? '-dynamiclib' : '-shared', '-fPIC', sourcePath, '-o', libraryPath], { encoding: 'utf8' });
    assert.equal(compiled.status, 0, compiled.stderr);
    const koffi = require('koffi');
    const fixture = koffi.load(libraryPath);
    const value = fixture.func('int fixture_value(int field)');
    const pixel = fixture.func('int fixture_pixel(int i)');
    const sample = fixture.func('float fixture_sample(int i)');
    const timestamp = fixture.func('int64_t fixture_timestamp(int type)');
    const name = fixture.func('const char *fixture_name(void)');
    const aspect = fixture.func('float fixture_aspect(void)');
    const options = { libraryPath, name: 'CastLink / Слот 1', width: 16, height: 16, fps: 25 };
    output = await startOmtOutput(options);
    assert.equal(name(), 'CastLink / Слот 1');
    assert.equal(value(13), 0);
    const video = Buffer.concat([Buffer.alloc(256, 16), Buffer.alloc(64, 70), Buffer.alloc(64, 190)]);
    const pcm = Buffer.alloc(16);
    [-32768, 32767, -16384, 16384, 0, -1, 8192, -8192].forEach((s, i) => pcm.writeInt16LE(s, i * 2));
    assert.equal(output.writeVideo(Buffer.alloc(1)), false);
    assert.equal(output.writeAudio(Buffer.alloc(3)), false);
    assert.equal(output.writeVideo(video), true);
    assert.equal(output.writeVideo(video), false, 'one pending video prevents unbounded native queues');
    assert.equal(output.writeAudio(pcm), true);
    assert.equal(output.writeAudio(pcm), false, 'one pending audio prevents unbounded native queues');
    video.fill(255); pcm.fill(0);
    // setImmediate must run while the intentionally slow C send is in flight.
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(value(17), 0, 'native encoding does not block the JS event loop');
    const stopped = output.stop();
    assert.equal(output.writeVideo(video), false);
    await stopped;
    await output.stop();
    assert.deepEqual(await output.closed, { code: 0, signal: null });
    assert.deepEqual(Array.from({ length: 8 }, (_, i) => value(i)), [16, 16, 16, 0x3231564e, 25, 1, 601, 384]);
    assert.ok(Math.abs(aspect() - 1) < 1e-6);
    assert.deepEqual([pixel(0), pixel(255), pixel(256), pixel(257), pixel(382), pixel(383)], [16, 16, 70, 190, 70, 190]);
    assert.deepEqual([value(8), value(9), value(10), value(11), value(12)], [48000, 2, 4, 0x31415046, 32]);
    assert.deepEqual(Array.from({ length: 8 }, (_, i) => sample(i)), [-1, -0.5, 0, 0.25, 32767 / 32768, 0.5, -1 / 32768, -0.25]);
    assert.ok(Math.abs(Number(timestamp(2)) - Number(timestamp(4))) < 1000000, 'audio/video timestamps share a monotonic epoch');
    assert.ok(timestamp(2) >= 0, 'caller pacing avoids native throttle on the JS thread');
    assert.deepEqual([value(14), value(15), value(16), value(17), value(18), value(19)], [1, 1, 0, 1, 1, 1]);
    await assert.rejects(() => startOmtOutput({ ...options, name: '__create_fail' }), /OMT_SENDER_CREATE/);
    second = await startOmtOutput({ ...options, name: '__send_zero' });
    assert.equal(second.writeVideo(Buffer.alloc(384)), true);
    await new Promise(resolve => setTimeout(resolve, 70));
    assert.equal(second.writeVideo(Buffer.alloc(384)), true, 'zero bytes sent without receivers is recoverable');
    await second.stop();
    assert.equal(value(15), 2);
    assert.equal(value(16), 0);
  } finally {
    await output?.stop();
    await second?.stop();
    rmSync(directory, { recursive: true, force: true });
  }
});
