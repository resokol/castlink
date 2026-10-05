import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../dist/args.js';

test('parses reproducible local dry-run without changing option values', () => {
  const parsed = parseArgs(['setup', '--target', 'local', '--profile', 'office', '--root', 'C:\\Users\\Owner\\CastLink тест', '--dry-run']);
  assert.equal(parsed.command, 'setup');
  assert.equal(parsed.profile, 'office');
  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.options.root, 'C:\\Users\\Owner\\CastLink тест');
});
test('rejects unknown commands, unknown flags and missing values', () => {
  for (const argv of [['erase'], ['setup', '--wat'], ['setup', '--host'], ['setup', '--profile', '--json']]) {
    assert.throws(() => parseArgs(argv), /command|option|value/i);
  }
});
test('rejects repeated arguments instead of silently changing target', () => {
  assert.throws(() => parseArgs(['setup', '--target', 'local', '--target', 'remote']), /repeat|duplicate/i);
});
test('explicit help works without runtime or profile', () => {
  assert.equal(parseArgs(['--help']).command, 'help');
});
test('refuses secrets as command-line options', () => {
  for (const option of ['--password', '--setup-token', '--private-key-content']) {
    assert.throws(() => parseArgs(['setup', option, 'sensitive-fixture']), /option/i);
  }
});
