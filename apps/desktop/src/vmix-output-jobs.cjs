'use strict';

const { normalizeSrt } = require('./vmix-output-config.cjs');
const { parseSlotLink } = require('./vmix-slot-tracks.cjs');
const { createHash } = require('node:crypto');

function nativeSlotName(id) {
  return `CastLink-${createHash('sha256').update(id).digest('hex').slice(0, 16)}`;
}

function buildVmixSlotJobs({ config, descriptors, origin, paths }) {
  if (!['srt', 'ndi', 'omt'].includes(config?.mode)) throw new Error('VMIX_PROTOCOL');
  const { mode, fps = 30, bitrateKbps = 8000, slots } = config;
  if (![30, 50, 60].includes(fps) || !Number.isInteger(bitrateKbps) || bitrateKbps < 500 || bitrateKbps > 25_000) throw new Error('VMIX_QUALITY');
  if (!Array.isArray(slots) || !slots.length || slots.length > 4 || new Set(slots.map(slot => slot?.id)).size !== slots.length) throw new Error('VMIX_SLOTS');
  const srt = mode === 'srt' ? normalizeSrt({ ...config.srt, slots }) : undefined;
  return slots.map(slot => {
    const descriptor = descriptors.find(item => item.id === slot?.id);
    if (!descriptor || !['camera', 'screen'].includes(slot.source)) throw new Error('VMIX_SLOT');
    const link = new URL(slot.source === 'camera' ? descriptor.cameraPath : descriptor.screenPath, origin).href;
    const parsed = parseSlotLink(link, origin);
    if (parsed.slotId !== slot.id || parsed.source !== slot.source) throw new Error('VMIX_SLOT_LINK');

    const output = { mode, origin, link, id: slot.id, name: nativeSlotName(slot.id), width: 1920, height: 1080, fps, bitrateKbps };
    if (mode === 'srt') {
      if (!paths.srt) throw new Error('VMIX_FFMPEG');
      if (srt.mode === 'rendezvous' && !paths.relay) throw new Error('VMIX_SRT_RENDEZVOUS');
      return { ...output, executable: paths.srt, relayExecutable: paths.relay, config: srt };
    }
    if (mode === 'omt' && !paths.omt) throw new Error('VMIX_OMT_RUNTIME');
    return { ...output, libraryPath: paths[mode] || undefined };
  });
}

module.exports = { buildVmixSlotJobs, nativeSlotName };
