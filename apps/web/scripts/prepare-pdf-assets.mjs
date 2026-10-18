import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Presentations are temporarily disabled. Remove generated assets left by an
// earlier checkout so development and new builds cannot serve old downloads.
export async function removePresentationAssets(publicDirectory = fileURLToPath(new URL('../public/', import.meta.url))) {
  await rm(join(publicDirectory, 'pdfjs'), { recursive: true, force: true });
  for (const name of ['CastLink-PowerPoint-Windows.ps1', 'CastLink-PowerPoint-macOS.js']) await rm(join(publicDirectory, 'helpers', name), { force: true });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await removePresentationAssets();
