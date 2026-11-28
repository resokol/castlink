'use strict';

const { existsSync } = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');

const runtime = process.resourcesPath && path.join(process.resourcesPath, 'vmix');
const load = runtime && existsSync(path.join(runtime, 'node_modules')) ? createRequire(path.join(runtime, 'package.json')) : require;

module.exports = { livekit: () => load('@livekit/rtc-node'), koffi: () => load('koffi') };
