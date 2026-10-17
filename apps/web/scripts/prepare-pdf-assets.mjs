import { createRequire } from 'node:module';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = dirname(require.resolve('pdfjs-dist/package.json'));
const target = fileURLToPath(new URL('../public/pdfjs/', import.meta.url));
const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
if (await readFile(join(target, '.version'), 'utf8').catch(() => '') !== version) {
  await mkdir(target, { recursive: true });
  for (const dir of ['cmaps', 'standard_fonts', 'wasm']) await cp(join(root, dir), join(target, dir), { recursive: true });
  await cp(join(root, 'build/pdf.worker.min.mjs'), join(target, 'pdf.worker.min.mjs'));
  await cp(join(root, 'LICENSE'), join(target, 'LICENSE'));
  await writeFile(join(target, '.version'), version);
}
