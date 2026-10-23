import test from 'node:test';
import assert from 'node:assert/strict';
import {registerParentImages, cleanupParentImages, expectedSource, mayRetireLeafImage} from '../production-image-retention.mjs';
const id = char => 'sha256:' + char.repeat(64);
const source = 'a'.repeat(40);
const layer = char => id(char);
function image(char, {parent = '', layers = [layer(char)], owner = true, from = source, stage = 'web-builder', tags = [], digests = []} = {}) {
  return {Id: id(char), Parent: parent, RootFS: {Layers: layers}, RepoTags: tags, RepoDigests: digests,
    Config: {Labels: owner ? {'ru.castlink.image.owner': 'castlink', 'ru.castlink.image.ownership': 'castlink-build-v1', 'ru.castlink.image.source': from, 'ru.castlink.image.stage': stage} : {}}};
}
function fixture() {
  const records = new Map(); const containers = new Map(); const removed = [];
  const add = record => (records.set(record.Id, record), record);
  const docker = args => {
    if (args[0] === 'image' && args[1] === 'inspect') {const record = records.get(args[2]); if (!record) throw Error('No such image'); return JSON.stringify(record);}
    if (args[0] === 'ps') {assert.deepEqual(args, ['ps', '-aq', '--no-trunc']); return [...containers.keys()].join('\n');}
    if (args[0] === 'inspect') {assert.equal(args.at(-1), '{{.Image}}'); return containers.get(args[1]) || '';}
    if (args[0] === 'image' && args[1] === 'rm') {assert.equal(args[2], '--no-prune'); assert.equal(args.length, 4); removed.push(args[3]); return '';}
    throw Error('Unexpected Docker call: ' + args.join(' '));
  };
  const receipt = {schemaVersion: 1, scope: '/fixture/compose.yml', parents: []};
  return {records, containers, removed, docker, add, receipt};
}
function register(f, currentImages) {return registerParentImages({docker: f.docker, receipt: f.receipt, source, currentImages});}

test('only loaded roots/ancestors with explicit source markers qualify; inherited foreign descendants excluded', () => {
  const f = fixture(); const foreign = f.add(image('f', {owner: false}));
  const parent = f.add(image('a', {parent: foreign.Id})); const wrongSource = f.add(image('b', {from: 'b'.repeat(40), parent: parent.Id}));
  const wrongStage = f.add(image('c', {stage: 'foreign', parent: wrongSource.Id})); const current = f.add(image('d', {parent: wrongStage.Id}));
  f.add(image('e', {parent: current.Id, layers: [layer('d'), layer('e')]}));
  assert.deepEqual(register(f, [current.Id]).parents.map(entry => entry.id).sort(), [id('a'), id('d')]);
});
test('current and all running/stopped ancestors protected; previously registered own unused root retires', () => {
  const f = fixture(); f.add(image('a')); const current = f.add(image('b', {parent: id('a'), layers: [layer('a'), layer('b')]}));
  f.add(image('c')); const stopped = f.add(image('d', {parent: id('c'), layers: [layer('c'), layer('d')], owner: false}));
  f.add(image('e')); const running = f.add(image('f', {parent: id('e'), layers: [layer('e'), layer('f')], owner: false}));
  f.add(image('1', {tags: null, digests: null})); f.containers.set('stopped', stopped.Id); f.containers.set('running', running.Id);
  const receipt = register(f, [current.Id, id('c'), id('e'), id('1')]);
  const result = cleanupParentImages({docker: f.docker, receipt, currentImages: [current.Id]});
  assert.deepEqual(f.removed, [id('1')]); assert.ok(!result.parents.some(entry => entry.id === id('1')));
});
test('modern empty Parent layer-prefix protection never grants ownership', () => {
  const f = fixture(); f.add(image('a')); const current = f.add(image('b', {layers: [layer('a'), layer('b')]}));
  f.add(image('c')); const stopped = f.add(image('d', {layers: [layer('c'), layer('d')], owner: false}));
  f.add(image('e', {owner: false, layers: [layer('a')]})); f.add(image('f'));
  f.containers.set('stopped', stopped.Id);
  cleanupParentImages({docker: f.docker, receipt: register(f, [id('a'), id('c'), id('f')]), currentImages: [current.Id]});
  assert.deepEqual(f.removed, [id('f')]);
});
test('changed/missing markers, extra or missing/invalid reference metadata and unknown layers preserve candidates', () => {
  const f = fixture(); const current = f.add(image('f', {owner: false}));
  const changed = f.add(image('a')); const missing = f.add(image('b')); f.add(image('c', {tags: ['foreign:keep']}));
  f.add(image('d', {digests: ['foreign@' + id('d')]})); const unknown = f.add(image('e')); const absent = f.add(image('1')); const invalid = f.add(image('2'));
  const receipt = register(f, [id('a'), id('b'), id('c'), id('d'), id('e'), id('1'), id('2')]);
  changed.Config.Labels['ru.castlink.image.stage'] = 'foreign'; missing.Config.Labels = {}; delete unknown.RootFS; delete absent.RepoTags; invalid.RepoDigests = 42;
  cleanupParentImages({docker: f.docker, receipt, currentImages: [current.Id]}); assert.deepEqual(f.removed, []);
});
test('incomplete current/container/parent observations abort cleanup', () => {
  for (const broken of ['layers', 'container', 'parent']) {
    const f = fixture(); const current = f.add(image('f', {owner: false})); f.add(image('a')); const receipt = register(f, [id('a')]);
    if (broken === 'layers') delete current.RootFS;
    if (broken === 'container') f.containers.set('stopped', 'unreadable');
    if (broken === 'parent') current.Parent = id('e');
    cleanupParentImages({docker: f.docker, receipt, currentImages: [current.Id]}); assert.deepEqual(f.removed, [], broken);
  }
});
test('unregistered images never adopted during cleanup; unknown short release source cannot register', () => {
  const f = fixture(); const current = f.add(image('f', {owner: false})); f.add(image('a'));
  cleanupParentImages({docker: f.docker, receipt: f.receipt, currentImages: [current.Id]}); assert.deepEqual(f.removed, []);
  assert.equal(expectedSource('studiolink_web:1.0.0-short', ''), ''); assert.equal(expectedSource('castlink-easy-web:' + source, ''), source);
  assert.throws(() => expectedSource('castlink-easy-web:' + source, 'b'.repeat(40)), /source/);
});
test('leaf ancestors protected by Parent and modern layers, same-ID alias safe only with retained tag', () => {
  const f = fixture(); const parent = f.add(image('a', {tags: ['old:leaf']})); const current = f.add(image('b', {parent: parent.Id, layers: [layer('a'), layer('b')]}));
  assert.equal(mayRetireLeafImage({docker: f.docker, currentImages: [current.Id], tag: parent.Id}), false);
  current.Parent = ''; assert.equal(mayRetireLeafImage({docker: f.docker, currentImages: [current.Id], tag: parent.Id}), false);
  current.RepoTags = ['old:alias', 'new:current']; f.records.set('old:alias', current);
  assert.equal(mayRetireLeafImage({docker: f.docker, currentImages: [current.Id], tag: 'old:alias'}), true);
  current.RepoTags = ['old:alias']; assert.equal(mayRetireLeafImage({docker: f.docker, currentImages: [current.Id], tag: 'old:alias'}), false);
  current.RootFS = null; assert.equal(mayRetireLeafImage({docker: f.docker, currentImages: [current.Id], tag: 'old:alias'}), false);
});
