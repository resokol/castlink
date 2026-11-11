import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

test('packager emits pinned self-contained Bash asset with side-effect-free pipeline help', async t => {
  const modulePath = new URL('../package-server-bootstrap.mjs', import.meta.url);
  assert.ok(await fs.stat(modulePath).catch(() => false), 'release bootstrap builder is missing');
  const {buildServerBootstrap} = await import(modulePath);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'castlink-bootstrap-package-'));
  t.after(() => fs.rm(directory, {recursive:true, force:true}));
  const bytes = Buffer.from('test archive bytes');
  await fs.writeFile(path.join(directory, 'CastLink-Linux.tar.gz'), bytes);
  const product = {track:'linux', repository:'resokol/castlink', version:'1.0.0-rc.8', sourceCommit:'a'.repeat(40), tag:'linux-v1.0.0-rc.8-'+'a'.repeat(12)};
  const result = await buildServerBootstrap({output:directory, product});
  const script = await fs.readFile(path.join(directory, 'install-server.sh'), 'utf8');
  assert.equal(result.name, 'install-server.sh');
  assert.equal(result.sha256, createHash('sha256').update(script).digest('hex'));
  assert.ok(script.includes(createHash('sha256').update(bytes).digest('hex')));
  assert.ok(script.includes(product.tag));
  assert.doesNotMatch(script, /@@CASTLINK_/);
  const help = spawnSync('bash', ['-s', '--', '--help'], {input:script, encoding:'utf8', cwd:directory, timeout:10000});
  assert.equal(help.status, 0, help.stderr); assert.match(help.stdout, /--state-dir/);
  assert.deepEqual((await fs.readdir(directory)).sort(), ['CastLink-Linux.tar.gz','install-server.sh']);
  await assert.rejects(buildServerBootstrap({output:directory, product:{...product, track:'server-setup'}}), /Linux/);
});
