'use strict';

const { randomUUID } = require('node:crypto');
const { selectSlotPublications } = require('./vmix-slot-tracks.cjs');

function createSlotSource({ sdk, link, frames, onState, onAssignment = () => {}, requestSnapshot, fetcher = fetch }) {
  const abort = new AbortController();
  const url = link.apiUrl && new URL(link.apiUrl);
  url?.searchParams.set('client', randomUUID());
  const subscribed = new Set();
  const readers = new Map();
  const kinds = ['video', 'audio'];
  const sources = {
    camera: sdk.TrackSource.SOURCE_CAMERA, microphone: sdk.TrackSource.SOURCE_MICROPHONE,
    screen: sdk.TrackSource.SOURCE_SCREENSHARE, screenAudio: sdk.TrackSource.SOURCE_SCREENSHARE_AUDIO,
  };
  let source, snapshot, revision = -1, roomName, pending, state, assignment, rotation = 0, revoked = false, reconnecting = false;

  function publishState(next) {
    if (state !== next) { state = next; onState(next); }
  }
  function publishAssignment(next) {
    if (assignment !== next) { assignment = next; onAssignment(next); }
  }

  async function fetchSnapshot() {
    const reply = await fetcher(url.href, { headers: { 'x-castlink-slot-access': link.access }, redirect: 'error',
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(6000)]) });
    if (reply.status === 403 || reply.status === 410) {
      revoked = true;
      throw new Error('VMIX_SLOT_REVOKED');
    }
    if (!reply.ok) throw new Error('VMIX_SLOT_UNAVAILABLE');
    return reply.json();
  }

  function detach(kind) {
    const binding = readers.get(kind);
    readers.delete(kind);
    if (kind === 'video') frames.clearVideo(); else frames.clearAudio();
    void binding?.reader.cancel().catch(() => {});
  }

  function reconcile() {
    const available = source?.isConnected && !reconnecting && !abort.signal.aborted;
    const tracks = available ? selectSlotPublications(snapshot, source.remoteParticipants, sources, link.studioId) : {};
    const participant = available && snapshot?.target && source.remoteParticipants.get(snapshot.target.identity);
    publishAssignment(participant?.sid === snapshot?.target?.participantSid && participant?.name ? participant.name : null);
    rotation = 0;
    if (tracks.video && link.source === 'camera') {
      try {
        const angle = JSON.parse(participant.metadata ?? '{}').videoRotation;
        if ([90, 180, 270].includes(angle)) rotation = angle;
      } catch { /* The sender may have no custom rotation metadata. */ }
    }
    const desired = new Set(Object.values(tracks));
    for (const old of subscribed) {
      if (desired.has(old)) continue;
      subscribed.delete(old);
      if (source?.isConnected) old.setSubscribed(false);
    }
    for (const publication of desired) {
      if (subscribed.has(publication)) continue;
      subscribed.add(publication);
      publication.setSubscribed(true);
    }
    for (const kind of kinds) {
      const track = tracks[kind]?.muted ? undefined : tracks[kind]?.track;
      if (readers.get(kind)?.track === track) continue;
      detach(kind);
      if (!track) continue;
      const stream = kind === 'video' ? new sdk.VideoStream(track) : new sdk.AudioStream(track, { sampleRate: 48_000, numChannels: 2 });
      const binding = { track, reader: stream.getReader() };
      readers.set(kind, binding);
      void (async () => {
        try {
          while (readers.get(kind) === binding && !abort.signal.aborted) {
            const { value, done } = await binding.reader.read();
            if (done || readers.get(kind) !== binding || abort.signal.aborted) break;
            if (kind === 'video') {
              const frame = value.frame.type === sdk.VideoBufferType.I420 ? value.frame : value.frame.convert(sdk.VideoBufferType.I420);
              const encodedAngle = [0, 90, 180, 270][value.rotation] || 0;
              frames.video(frame, (encodedAngle + rotation) % 360);
            } else frames.audio(value.data);
            publishState('source');
          }
        } catch { /* The SDK can end a reader during a track replacement. */ }
        finally { if (readers.get(kind) === binding) detach(kind); }
      })();
    }
    if (!readers.size) publishState(snapshot?.phase === 'assigned' ? 'connecting' : 'waiting');
  }

  const clear = () => {
    for (const kind of kinds) detach(kind);
    subscribed.clear();
  };
  function createRoom() {
    const room = new sdk.Room();
    function register(name, apply) {
      if (sdk.RoomEvent[name]) room.on(sdk.RoomEvent[name], () => { if (room === source && !abort.signal.aborted) apply(); });
    }
    for (const name of ['TrackPublished', 'TrackUnpublished', 'TrackSubscribed', 'TrackUnsubscribed', 'TrackMuted', 'TrackUnmuted',
      'ParticipantConnected', 'ParticipantDisconnected', 'ParticipantMetadataChanged', 'ParticipantNameChanged']) register(name, reconcile);
    register('Reconnected', () => { reconnecting = false; reconcile(); });
    const disconnected = () => {
      reconnecting = true;
      clear();
      publishAssignment(null);
      publishState('connecting');
    };
    register('Reconnecting', disconnected);
    register('Disconnected', disconnected);
    return room;
  }

  async function refreshOnce() {
    if (abort.signal.aborted || revoked) return;
    try {
      const { snapshot: next, token, room } = await (requestSnapshot || fetchSnapshot)();
      if (abort.signal.aborted) return;
      if (typeof token !== 'string' || !room || !Number.isSafeInteger(next?.revision) || next.source !== link.source) throw new Error('VMIX_SLOT_RESPONSE');
      if (roomName !== room) {
        snapshot = undefined;
        revision = -1;
        clear();
        const previous = source;
        source = undefined;
        if (previous?.isConnected) await previous.disconnect();
        roomName = room;
      }
      if (next.revision < revision) return;
      revision = next.revision;
      snapshot = next;
      if (!source?.isConnected && !abort.signal.aborted) {
        source = createRoom();
        reconnecting = false;
        await source.connect(link.livekitUrl, token, { autoSubscribe: false, dynacast: false });
      }
      reconcile();
    } catch {
      snapshot = undefined;
      if (!abort.signal.aborted) {
        reconcile();
        if (revoked && source?.isConnected) await source.disconnect().catch(() => {});
        publishState(revoked ? 'revoked' : 'unavailable');
      }
    }
  }

  return {
    refresh() {
      if (!pending) pending = refreshOnce().finally(() => { pending = undefined; });
      return pending;
    },
    async stop() {
      abort.abort();
      snapshot = undefined;
      clear();
      await pending;
      await source?.disconnect();
    },
  };
}

module.exports = { createSlotSource };
