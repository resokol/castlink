import { studioVideoConstraints, type StudioFrameRate } from './video-quality';
export type StudioVideoSource = 'camera' | 'black';
export function studioCaptureConstraints(source: StudioVideoSource, videoDevice: string, audioDevice: string, fps: StudioFrameRate): MediaStreamConstraints {
  return { video: source === 'black' ? false : studioVideoConstraints(videoDevice, fps), audio: { ...(audioDevice ? { deviceId: { exact: audioDevice } } : {}), echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 }, sampleRate: { ideal: 48000 } } };
}
/** Synthetic source never opens a camera. Keep frames flowing for WebRTC receivers. */
export function createBlackStudioVideo(fps: number): { track: MediaStreamTrack; stop: () => void } {
  const canvas = document.createElement('canvas'); canvas.width = 1920; canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof canvas.captureStream !== 'function') throw new Error('Браузер не поддерживает источник «Чёрный фон»');
  const paint = () => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height); };
  paint(); const stream = canvas.captureStream(fps), track = stream.getVideoTracks()[0];
  if (!track) throw new Error('Не удалось создать чёрный видеопоток');
  const timer = setInterval(paint, Math.max(16, Math.round(1000 / fps)));
  return { track, stop: () => { clearInterval(timer); stream.getTracks().forEach(t => t.stop()); canvas.width = canvas.height = 0; } };
}
/** Monitor/meter remain before the output silence gate; relay clones the gated track. */
export function connectStudioOutputAudio(ctx: AudioContext, input: GainNode, analyser: AnalyserNode, monitor: MediaStreamAudioDestinationNode, muted: boolean) {
  const gain = ctx.createGain(); gain.gain.value = muted ? 0 : 1;
  const destination = ctx.createMediaStreamDestination();
  input.connect(analyser); input.connect(monitor); input.connect(gain); gain.connect(destination);
  return { gain, stream: destination.stream };
}
