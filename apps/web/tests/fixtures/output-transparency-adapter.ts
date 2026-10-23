// Deterministic SFU boundary for the real output page/browser regression.
export const RoomEvent = Object.fromEntries([
  'TrackSubscribed', 'TrackPublished', 'ParticipantConnected', 'ParticipantDisconnected',
  'ParticipantMetadataChanged', 'TrackUnsubscribed', 'TrackMuted', 'TrackUnmuted',
  'Reconnected', 'Disconnected',
].map(name => [name, name]));
export const Track = { Kind: { Video: 'video', Audio: 'audio' }, Source: {
  Camera: 'camera', Microphone: 'microphone', ScreenShare: 'screen_share', ScreenShareAudio: 'screen_share_audio',
} };
export const VideoQuality = { HIGH: 2 };
export const target = { sessionId: 'session-a', identity: 'guest-a', generation: 1, participantSid: 'PA-A' };
export let snapshot = { revision: 1, phase: 'empty', target: null as typeof target | null, source: new URLSearchParams(location.search).get('source') || 'camera' };
export class Room {
  static current: Room;
  state = 'disconnected';
  remoteParticipants = new Map();
  localParticipant = { identity: 'output-client' };
  listeners = new Map<string, Set<(...args: any[]) => void>>();
  constructor() { Room.current = this; }
  on(name: string, fn: (...args: any[]) => void) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name)!.add(fn); return this; }
  off(name: string, fn: (...args: any[]) => void) { this.listeners.get(name)?.delete(fn); return this; }
  emit(name: string, ...args: any[]) { for (const fn of this.listeners.get(name) || []) fn(...args); }
  removeAllListeners() { this.listeners.clear(); }
  async connect() { this.state = 'connected'; }
  async disconnect() { this.state = 'disconnected'; }
  async startAudio() {}
}
export const useParams = () => ({ slotId: 'slot-a' });
const search = new URLSearchParams(location.search);
export const useSearchParams = () => search;
export const useI18n = () => ({ t: (value: string) => value });
export const getLiveKitUrl = () => 'wss://example.invalid';

const canvas = document.createElement('canvas');
canvas.width = 640; canvas.height = 360;
const paint = () => {
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#00b060'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#fff'; context.fillText('live source', 40, 40);
};
paint(); setInterval(paint, 100);
const stream = canvas.captureStream(10);
const publication = (source: string) => ({ source, kind: 'video', isMuted: false, isSubscribed: false,
  track: { source, kind: 'video', attach() { const video = document.createElement('video'); video.srcObject = stream; return video; }, detach() {} },
  setSubscribed(value: boolean) { this.isSubscribed = value; }, setVideoQuality() {},
});
const participant = { identity: target.identity, sid: target.participantSid,
  metadata: JSON.stringify({ admissionId: target.sessionId, admissionGeneration: target.generation }),
  trackPublications: new Map([['camera', publication('camera')], ['screen', publication('screen_share')]]),
};
let errorStatus = 0;
window.fetch = async () => ({ ok: !errorStatus, status: errorStatus || 200, json: async () => ({ room: 'room-a', token: 'opaque-test-token', snapshot }) }) as Response;
export const qa = {
  assign() { snapshot = { ...snapshot, revision: snapshot.revision + 1, phase: 'assigned', target }; Room.current.remoteParticipants.set(target.identity, participant); Room.current.emit(RoomEvent.ParticipantConnected, participant); },
  leave() { Room.current.remoteParticipants.delete(target.identity); Room.current.emit(RoomEvent.ParticipantDisconnected, participant); },
  reconnect() { Room.current.remoteParticipants.set(target.identity, participant); Room.current.emit(RoomEvent.Reconnected); },
  idle() { snapshot = { ...snapshot, revision: snapshot.revision + 1, phase: 'empty', target: null }; },
  invalidate() { errorStatus = 403; },
};
