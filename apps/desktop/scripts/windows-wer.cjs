'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

// Electron 45 looks up the WER helper beside the process executable. The NSIS
// installer and portable wrapper both carry the same renamed Electron payload.
module.exports = async function afterPack({ electronPlatformName, appOutDir, packager }) {
  if (electronPlatformName !== 'win32') return;
  const stem = packager.appInfo.productFilename;
  await fs.access(path.join(appOutDir, stem + '.exe'));
  await fs.rename(path.join(appOutDir, 'electron_wer.dll'), path.join(appOutDir, stem + '_wer.dll'));
};
