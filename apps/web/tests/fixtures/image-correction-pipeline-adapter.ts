// Explicit test boundaries: SFU/control-plane, external mixer/Studio Return,
// locale controls and passive transfer. The output/watch pages remain real.
export const RoomEvent = Object.fromEntries([
  'TrackSubscribed', 'TrackUnsubscribed', 'TrackPublished', 'ParticipantConnected',
  'ParticipantDisconnected', 'ParticipantMetadataChanged', 'TrackMuted',
  'TrackUnmuted', 'Reconnected', 'Reconnecting', 'Disconnected',
].map(name => [name, name]));
export const Track = { Kind: { Video: 'video', Audio: 'audio' }, Source: {
  Camera: 'camera', Microphone: 'microphone', ScreenShare: 'screen_share', ScreenShareAudio: 'screen_share_audio',
} };
export const VideoQuality = { HIGH: 2 };
export const useParams = () => ({ slotId: 'slot-a' });
const search = new URLSearchParams(location.search);
export const useSearchParams = () => search;
export const useI18n = () => ({ t: (value: string) => value, locale: 'ru' });
export const getLiveKitUrl = () => 'wss://test-sfu.invalid';
export const InlineLanguageSwitcher = () => null;
export const readTransferSnapshot = () => undefined;
export const clearTransferSnapshot = () => {};
export const useSessionTransfer = () => ({ view: undefined });
export const guestReserveStatusText = () => '';
const watch = location.pathname === '/watch';
const target = { sessionId: 'session-a', identity: 'guest-a', generation: 1, participantSid: 'PA-A' };
let snapshot = { revision: 1, phase: 'empty', target: null as typeof target | null, source: search.get('source') || 'camera' };
export class Room {
  static current: Room;
  state = 'disconnected';
  remoteParticipants = new Map();
  localParticipant = { identity: 'output-client' };
  listeners = new Map<string, Set<(...args: any[]) => void>>();
  constructor() { Room.current = this; if (watch) { this.remoteParticipants.set(rawGuest.identity, rawGuest); this.remoteParticipants.set(studio.identity, studio); } }
  on(name: string, fn: (...args: any[]) => void) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name)!.add(fn); return this; }
  off(name: string, fn: (...args: any[]) => void) { this.listeners.get(name)?.delete(fn); return this; }
  emit(name: string, ...args: any[]) { for (const fn of this.listeners.get(name) || []) fn(...args); }
  removeAllListeners() { this.listeners.clear(); }
  async connect() { this.state = 'connected'; }
  async disconnect() { this.state = 'disconnected'; }
  async startAudio() {}
}
const canvas = document.createElement('canvas');
canvas.width = 640; canvas.height = 360;
let composedFrame: HTMLImageElement | undefined;
const paint = () => {
  const context = canvas.getContext('2d')!;
  if (composedFrame) context.drawImage(composedFrame, 0, 0, canvas.width, canvas.height);
  else { context.fillStyle = 'rgb(96,96,96)'; context.fillRect(0, 0, canvas.width, canvas.height); }
};
paint(); setInterval(paint, 50);
const stream = canvas.captureStream(20);
let attachments = 0;
const subscriptions: { identity: string; enabled: boolean }[] = [];
const publication = (source: string, owner: () => { identity: string }, sourceStream = stream) => ({ source, kind: 'video', isMuted: false, isSubscribed: false,
  track: { source, kind: 'video', attach(existing?: HTMLVideoElement) { attachments++; const element = existing || document.createElement('video'); element.srcObject = sourceStream; return element; }, detach() {} },
  setSubscribed(value: boolean) { const changed = value !== this.isSubscribed; this.isSubscribed = value; subscriptions.push({ identity: owner().identity, enabled: value }); if (watch && value && changed) Room.current.emit(RoomEvent.TrackSubscribed, this.track, this, owner()); },
  setVideoQuality() {},
});
const camera = publication('camera', () => participant), screen = publication('screen_share', () => participant);
const participant = { identity: target.identity, sid: target.participantSid,
  metadata: JSON.stringify({ admissionId: target.sessionId, admissionGeneration: target.generation }),
  trackPublications: new Map([['camera', camera], ['screen', screen]]),
};
const returnPublication = publication('camera', () => studio);
const studio = { identity: 'studio-panel-main', sid: 'PA-STUDIO', metadata: '{"role":"studio"}', trackPublications: new Map([['return-video', returnPublication]]) };
// A distinct raw source remains available at gray96 to detect an accidental
// /watch subscription to the caster instead of the already-composed return.
const rawCanvas = document.createElement('canvas'); rawCanvas.width = 640; rawCanvas.height = 360;
rawCanvas.getContext('2d')!.fillStyle = 'rgb(96,96,96)'; rawCanvas.getContext('2d')!.fillRect(0, 0, 640, 360);
const rawPublication = publication('camera', () => rawGuest, rawCanvas.captureStream(20));
const rawGuest = { identity: 'raw-caster', sid: 'PA-RAW', metadata: '{"role":"guest"}', trackPublications: new Map([['raw-camera', rawPublication]]) };
const requests: { url: string; action?: string }[] = [];
window.fetch = async (url, options) => {
  const action = options?.body ? JSON.parse(String(options.body)).action : undefined;
  requests.push({ url: String(url), action });
  return new Response(JSON.stringify(watch ? { token: 'test-viewer-token', online: true, tracks: 1 } : { room: 'room-a', token: 'test-output-token', snapshot }), { status: 200, headers: { 'content-type': 'application/json' } });
};
export const qa = {
  requests,
  subscriptions,
  attachments: () => attachments,
  assign() { snapshot = { ...snapshot, revision: snapshot.revision + 1, phase: 'assigned', target }; Room.current.remoteParticipants.set(target.identity, participant); Room.current.emit(RoomEvent.ParticipantConnected, participant); },
  image(value: Record<string, number>) { participant.metadata = JSON.stringify({ admissionId: target.sessionId, admissionGeneration: target.generation, studioImageTransform: value }); Room.current.emit(RoomEvent.ParticipantMetadataChanged, participant); },
  leave() { Room.current.remoteParticipants.delete(target.identity); Room.current.emit(RoomEvent.ParticipantDisconnected, participant); },
  async mixerFrame(dataURL: string) { const image = new Image(); image.src = dataURL; await image.decode(); composedFrame = image; paint(); },
};
