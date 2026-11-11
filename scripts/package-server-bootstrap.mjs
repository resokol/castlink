import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Call after CastLink-Linux.tar.gz is final, before writing SHA256SUMS. */
export async function buildServerBootstrap({root = sourceRoot, output, product}) {
  if (product?.track !== 'linux' || product.repository !== 'resokol/castlink'
      || !/^[a-f0-9]{40}$/.test(product.sourceCommit ?? '')
      || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(product.version ?? '')
      || product.tag !== `linux-v${product.version}-${product.sourceCommit.slice(0, 12)}`) {
    throw Error('Bootstrap requires the exact Linux product release identity');
  }
  const archive = path.join(output, 'CastLink-Linux.tar.gz');
  const info = await fs.lstat(archive);
  if (!info.isFile() || info.size <= 0 || info.size > 4 * 1024 ** 3) throw Error('Invalid Linux archive for bootstrap');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(archive)) hash.update(chunk);
  const pin = {repository:product.repository, tag:product.tag, version:product.version, sourceCommit:product.sourceCommit,
    archiveSha256:hash.digest('hex'), archiveBytes:info.size};
  const [template, source] = await Promise.all([
    fs.readFile(path.join(root, 'scripts/install-server.sh'), 'utf8'),
    fs.readFile(path.join(root, 'scripts/install-server.py'), 'utf8'),
  ]);
  const python = source.replace('PIN = None  # @@CASTLINK_RELEASE_PIN@@', () => 'PIN = ' + JSON.stringify(pin));
  const script = template.replace('@@CASTLINK_PYTHON@@', () => python).replace(/\r\n/g, '\n');
  if (script.includes('@@CASTLINK_')) throw Error('Incomplete bootstrap template');
  const name = 'install-server.sh', file = path.join(output, name);
  await fs.writeFile(file, script, {mode:0o755});
  return {name, file, sha256:createHash('sha256').update(script).digest('hex'), pin};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = path.resolve(process.argv[2] ?? '.');
  const product = JSON.parse(await fs.readFile(path.join(output, 'manifest.json'), 'utf8'));
  const result = await buildServerBootstrap({output, product});
  console.log(`${result.sha256}  ${result.name}`);
}
