import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Run after pnpm install. Sharp is the existing Next.js image dependency.
const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url));
const sharp = createRequire(webRequire.resolve('next/package.json'))('sharp');
const root = fileURLToPath(new URL('../', import.meta.url));
const svg = await fs.readFile(path.join(root, 'assets/brand/castlink-icon.svg'));
const sizes = [16, 24, 32, 48, 64, 128, 256];

// Uncompressed BGRA DIB frames work with the Framework WPF decoder and csc,
// including at 256px. Transparent pixels also have the legacy AND mask set.
function iconFrame(rgba, size) {
  const maskStride = Math.ceil(size / 32) * 4;
  const dib = Buffer.alloc(40 + size * size * 4 + maskStride * size);
  dib.writeUInt32LE(40, 0);
  dib.writeInt32LE(size, 4);
  dib.writeInt32LE(size * 2, 8);
  dib.writeUInt16LE(1, 12);
  dib.writeUInt16LE(32, 14);
  dib.writeUInt32LE(size * size * 4, 20);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const source = (y * size + x) * 4;
      const pixel = 40 + ((size - y - 1) * size + x) * 4;
      dib[pixel] = rgba[source + 2];
      dib[pixel + 1] = rgba[source + 1];
      dib[pixel + 2] = rgba[source];
      dib[pixel + 3] = rgba[source + 3];
      if (rgba[source + 3] === 0) {
        dib[40 + size * size * 4 + (size - y - 1) * maskStride + (x >> 3)] |= 128 >> (x % 8);
      }
    }
  }
  return dib;
}

const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
const frames = [];
let offset = header.length;
for (const [index, size] of sizes.entries()) {
  const rgba = await sharp(svg).resize(size, size).ensureAlpha().raw().toBuffer();
  const frame = iconFrame(rgba, size);
  const entry = 6 + index * 16;
  header[entry] = header[entry + 1] = size === 256 ? 0 : size;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(frame.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  frames.push(frame);
  offset += frame.length;
}
const ico = Buffer.concat([header, ...frames]);
for (const [relative, bytes] of [
  ['apps/web/app/icon.svg', svg],
  ['apps/web/app/favicon.ico', ico],
  ['scripts/simple-easy-setup-control.ico', ico],
  ['apps/web/app/apple-icon.png', await sharp(svg).resize(180, 180).png().toBuffer()],
]) {
  await fs.writeFile(path.join(root, relative), bytes);
}
console.log('CastLink icons generated from canonical SVG: 7 ICO sizes, web SVG, Apple PNG.');
