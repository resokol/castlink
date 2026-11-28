'use strict';

function parseSlotLink(link, trustedOrigin) {
  if (typeof link !== 'string' || link.length > 12_000) throw new Error('VMIX_SLOT_LINK');
  let page;
  try { page = new URL(link, trustedOrigin); } catch { throw new Error('VMIX_SLOT_LINK'); }
  const slotId = /^\/output\/slot\/([a-z0-9_-]{1,100})\/?$/i.exec(page.pathname)?.[1];
  const source = page.searchParams.get('source') || 'camera';
  const studioId = page.searchParams.get('studioId') || 'studio-default';
  const access = new URLSearchParams(page.hash.slice(1)).get('access');
  if (!['http:', 'https:'].includes(page.protocol) || page.origin !== trustedOrigin || page.username || page.password ||
      !slotId || !['camera', 'screen'].includes(source) || !/^[A-Za-z0-9._:-]{6,128}$/u.test(studioId) ||
      !access || /[\u0000-\u0020\u007f]/u.test(access)) throw new Error('VMIX_SLOT_LINK');
  const apiUrl = new URL('/api/caster-slot-output', page.origin);
  apiUrl.search = new URLSearchParams({ studioId, slot: slotId, source }).toString();
  const livekitUrl = new URL(page.origin);
  livekitUrl.protocol = page.protocol === 'https:' ? 'wss:' : 'ws:';
  return { slotId, source, studioId, access, apiUrl, livekitUrl: livekitUrl.origin };
}

function selectSlotPublications(snapshot, participants, sources, studioId) {
  const target = snapshot?.target;
  if (snapshot?.phase !== 'assigned' || !target) return {};
  const owner = participants.get(target.identity);
  if (!owner || owner.sid !== target.participantSid) return {};
  let metadata;
  try { metadata = JSON.parse(owner.metadata || '{}') || {}; } catch { return {}; }
  const signedAssignment = metadata.admissionId === target.sessionId && metadata.admissionGeneration === target.generation;
  if (!signedAssignment && !(target.legacy && studioId && metadata.role === 'guest' && metadata.studioId === studioId)) return {};

  const screen = snapshot.source === 'screen';
  const alias = screen && snapshot.remotePcSource;
  const sender = alias ? participants.get(alias.helper.identity) : owner;
  if (!sender || (alias && (sender.sid !== alias.helper.sid || alias.owner.identity !== owner.identity || alias.owner.sid !== owner.sid))) return {};
  const publications = [...sender.trackPublications.values()];
  const video = publications.find(track => track.source === (screen ? sources.screen : sources.camera) && (!alias || track.sid === alias.videoTrackSid));
  if (alias && !video) return {};
  const audio = publications.find(track => track.source === (screen ? sources.screenAudio : sources.microphone) && (!alias || track.sid === alias.audioTrackSid));
  return { ...(video ? { video } : {}), ...(audio ? { audio } : {}) };
}

module.exports = { parseSlotLink, selectSlotPublications };
