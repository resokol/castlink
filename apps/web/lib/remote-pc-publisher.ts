import { Room, RoomEvent, Track, type RemoteParticipant } from 'livekit-client';
import { watchGuestAudioPermissions } from './guest-audio-permissions';
import { REMOTE_PC_MOVE_TOPIC, REMOTE_PC_RELIABLE_TOPIC } from './remote-pc-protocol';
import { createRemotePcPublisherControlsRelay, type RemotePcControlsBinding, type RemotePcControlsState } from './remote-pc-controls-relay';
import type { RemotePcParticipant } from './remote-pc-protocol';
export type RemotePublisherConfig = { captureId: string; publisher: { identity: string; token: string; url: string }; controls?: RemotePcControlsBinding; audioUnavailable?: boolean; audio?: { id: string; sampleRate: 48000; channels: 2 } };
export type RemotePublisherControls = {state: RemotePcControlsState | undefined; action(kind: 'delegate' | 'revoke', controller?: RemotePcParticipant): boolean};
export type RemotePublisherBridge = {
  config(): Promise<RemotePublisherConfig>;
  captured(value: { captureId: string; width: number; height: number }): Promise<{publisher?: RemotePublisherConfig['publisher']; inputState?: string; pointerReady?: boolean}>;
  geometry(value: { captureId: string; width: number; height: number }): Promise<unknown>;
  published(value: { captureId: string; helperSid: string; videoTrackSid: string; audioTrackSid?: string }): Promise<unknown>;
  data(value: { captureId: string; senderSid: string; topic: string; bytes: Uint8Array }): Promise<unknown>;
  captureStopped(value:{captureId:string}): Promise<void>;
  stop(): Promise<void>;
  onStop(listener: () => void): () => void;
  onState(listener: (value: {state: string; inputState?: string; pointerReady?: boolean; reason?: string}) => void): () => void;
  onAudio(listener: (value: {id: string; frames: number; pcm: Uint8Array}) => void): () => void;
  onAudioEnded(listener: (value: {id: string}) => void): () => void;
};
declare global { interface Window { castlinkRemotePublisher?: RemotePublisherBridge } }
/** No browser microphone/system loopback. The only optional audio is the
 * main-owned, explicitly selected PowerPoint process capture. */
async function processAudio(bridge: RemotePublisherBridge, info: NonNullable<RemotePublisherConfig['audio']>) {
  const context = new AudioContext({sampleRate: 48000}), destination = context.createMediaStreamDestination();
  const processor = context.createScriptProcessor(2048, 0, 2), ring = new Float32Array(96000);
  let write = 0, read = 0, count = 0, closed = false;
  const remove = bridge.onAudio(value => {
    if (closed || value.id !== info.id || !Number.isInteger(value.frames) || value.frames < 1 || value.frames > 4800) return;
    const bytes = new Uint8Array(value.pcm); if (bytes.byteLength !== value.frames * 8) return;
    const pcm = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
    for (let i = 0; i < value.frames; i++) {
      if (count === 48000) { read = (read + 1) % 48000; count--; }
      for (let ch = 0; ch < 2; ch++) ring[write * 2 + ch] = Number.isFinite(pcm[i * 2 + ch]) ? pcm[i * 2 + ch] : 0;
      write = (write + 1) % 48000; count++;
    }
  });
  processor.onaudioprocess = event => {
    const left = event.outputBuffer.getChannelData(0), right = event.outputBuffer.getChannelData(1);
    for (let i = 0; i < left.length; i++) {
      left[i] = count ? ring[read * 2] : 0; right[i] = count ? ring[read * 2 + 1] : 0;
      if (count) { read = (read + 1) % 48000; count--; }
    }
  };
  processor.connect(destination);
  const close = () => { if (closed) return; closed = true; remove(); processor.disconnect(); destination.stream.getTracks().forEach(t => t.stop()); void context.close(); };
  const removeEnded = bridge.onAudioEnded(value => { if (value.id === info.id) close(); });
  try { await context.resume(); if (context.state !== 'running') throw Error('Audio unavailable'); }
  catch (error) { close(); removeEnded(); throw error; }
  return {track: destination.stream.getAudioTracks()[0], close: () => { removeEnded(); close(); }};
}
export async function startRemotePublisher(bridge: RemotePublisherBridge, status: (text: string) => void, controls?: (value: RemotePublisherControls | undefined) => void) {
  const room = new Room({adaptiveStream: false, dynacast: false}), removePermissions = watchGuestAudioPermissions(room);
  let stream: MediaStream | undefined, sound: Awaited<ReturnType<typeof processAudio>> | undefined, preview: HTMLVideoElement | undefined, closed = false;
  let removeStop = () => {}, removeState = () => {};
  let controlsRelay: ReturnType<typeof createRemotePcPublisherControlsRelay> | undefined;
  let latestState: {state?: string; inputState?: string; pointerReady?: boolean} | undefined, audioUnavailable = false;
  const describe = (value: NonNullable<typeof latestState>) => {
    const text = value.inputState === 'paused' || value.state === 'paused' ? 'Показ продолжается. Управление приостановлено.' : value.pointerReady === false ? 'Показ продолжается. Указатель приостановлен; клавиатура доступна.' : value.state === 'stopped' ? 'Демонстрация остановлена' : 'Экран демонстрируется. Локальное управление сохранено.';
    status(text + (audioUnavailable ? ' Звук PowerPoint недоступен.' : ''));
  };
  const close = async () => {
    if (closed) return; closed = true; removeStop(); removeState(); removePermissions();controlsRelay?.dispose();controlsRelay = undefined;controls?.(undefined);
    stream?.getTracks().forEach(t => t.stop()); sound?.close(); if (preview) { preview.srcObject = null; preview.remove(); }
    room.removeAllListeners(); await room.disconnect();
  };
  const stop = async () => { await close(); await bridge.stop(); };
  try {
    const config = await bridge.config(); if (closed) return close;
    removeStop = bridge.onStop(() => { void close().then(() => bridge.captureStopped({captureId: config.captureId})).catch(() => {}); });
    audioUnavailable = config.audioUnavailable === true;
    removeState = bridge.onState(value => { latestState = value; describe(value); });
    status('Открываем выбранный источник…');
    // Electron main consumes precisely the owner's single native-picker choice.
    stream = await navigator.mediaDevices.getDisplayMedia({video: {frameRate: 30}, audio: false});
    if (closed) { stream.getTracks().forEach(t => t.stop()); return close; }
    const video = stream.getVideoTracks()[0]; if (!video) throw Error('Video unavailable');
    video.addEventListener('ended', () => { void stop(); }, {once: true});
    preview = document.createElement('video'); preview.muted = true; preview.playsInline = true; preview.autoplay = true;
    preview.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none'; preview.srcObject = stream; document.body.append(preview); await preview.play();
    if (!preview.videoWidth) await new Promise<void>((resolve, reject) => { preview!.addEventListener('loadedmetadata', () => resolve(), {once: true}); video.addEventListener('ended', () => reject(Error('Capture ended')), {once: true}); });
    let width = preview.videoWidth, height = preview.videoHeight;
    const bound = await bridge.captured({captureId: config.captureId, width, height});
    if (bound.publisher) config.publisher = bound.publisher;
    let resizing = Promise.resolve(); preview.addEventListener('resize', () => {
      if (!preview || closed || !preview.videoWidth || !preview.videoHeight || width === preview.videoWidth && height === preview.videoHeight) return;
      width = preview.videoWidth; height = preview.videoHeight; const geometry = {captureId: config.captureId, width, height};
      resizing = resizing.then(() => bridge.geometry(geometry)).then(() => undefined).catch(() => status('Показ продолжается. Геометрия управления недоступна.'));
    });
    room.on(RoomEvent.DataReceived, (bytes: Uint8Array, sender?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (closed || !sender?.sid || !topic || ![REMOTE_PC_RELIABLE_TOPIC, REMOTE_PC_MOVE_TOPIC].includes(topic) || bytes.byteLength > 8192) return;
      void bridge.data({captureId: config.captureId, senderSid: sender.sid, topic, bytes}).catch(() => {});
    });
    room.on(RoomEvent.Disconnected, () => { if (!closed) void stop(); });
    await room.connect(config.publisher.url, config.publisher.token, {autoSubscribe: false});
    if (closed || room.localParticipant.identity !== config.publisher.identity) throw Error('Publisher mismatch');
    if (config.controls) {
      controlsRelay = createRemotePcPublisherControlsRelay({room,binding:config.controls,captureId:config.captureId,onState:state => {
        if (!closed && controlsRelay) controls?.({state,action:controlsRelay.action});
      }});
      controls?.({state:undefined,action:controlsRelay.action});
    }
    const publication = await room.localParticipant.publishTrack(video, {source: Track.Source.ScreenShare, name: 'CastLink screen', simulcast: false});
    let audioTrackSid: string | undefined;
    if (config.audio) try {
      sound = await processAudio(bridge, config.audio);
      const audio = await room.localParticipant.publishTrack(sound.track, {source: Track.Source.ScreenShareAudio, name: 'CastLink PowerPoint audio'}); audioTrackSid = audio.trackSid;
    } catch { sound?.close(); audioUnavailable = true; }
    if (!publication.trackSid || !room.localParticipant.sid) throw Error('Publication unavailable');
    await bridge.published({captureId: config.captureId, helperSid: room.localParticipant.sid, videoTrackSid: publication.trackSid, ...(audioTrackSid ? {audioTrackSid} : {})});
    describe(latestState || bound); return stop;
  } catch (error) { await stop(); throw error; }
}
