import { Track, type TrackProcessor, type ProcessorOptions } from 'livekit-client';
import { type CameraTransform } from './camera-transform';
/** Sender-side transform. Owns only its canvas output, never the source camera. */
export class CameraTransformProcessor implements TrackProcessor<Track.Kind.Video> {
  readonly name = 'castlink-camera-transform';
  processedTrack?: MediaStreamTrack;
  private video?: HTMLVideoElement;
  private canvas?: HTMLCanvasElement;
  private timer?: ReturnType<typeof setTimeout>;
  private callback?: number;
  private generation = 0;
  private source?: MediaStreamTrack;
  private drawFrame?: () => void;
  private suspended = false;
  get sourceTrack() { return this.source; }
  suspend() {
    this.suspended = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.callback !== undefined) this.video?.cancelVideoFrameCallback?.(this.callback);
    this.timer = undefined; this.callback = undefined;
    if (this.processedTrack) this.processedTrack.enabled = false;
    if (this.video) { this.video.pause(); this.video.srcObject = null; }
  }
  async resume() {
    if (!this.suspended || !this.source || this.source.readyState !== "live" || !this.video) return;
    const generation = this.generation;
    this.video.srcObject = new MediaStream([this.source]);
    await this.video.play();
    if (generation !== this.generation || this.source?.readyState !== "live") return;
    this.suspended = false;
    if (this.processedTrack) this.processedTrack.enabled = true;
    this.drawFrame?.();
  }
  private sourceEnded = () => this.suspend();
  constructor(public transform: CameraTransform) {}
  async init(options: ProcessorOptions<Track.Kind.Video>) {
    if (typeof HTMLCanvasElement === 'undefined' || !HTMLCanvasElement.prototype.captureStream) throw new Error('Браузер не поддерживает обработку камеры');
    const generation = ++this.generation;
    this.source = options.track; this.suspended = false;
    options.track.addEventListener?.("ended", this.sourceEnded);
    const video = document.createElement('video');
    video.muted = true; video.autoplay = true; video.playsInline = true;
    video.srcObject = new MediaStream([options.track]); this.video = video;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([video.play(), new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Камера не подготовлена к обработке')), 5000); })]);
      if (generation !== this.generation) throw new Error('Обработка камеры отменена');
      const settings = options.track.getSettings();
      const canvas = document.createElement('canvas'); this.canvas = canvas;
      canvas.width = video.videoWidth || settings.width || 1280; canvas.height = video.videoHeight || settings.height || 720;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Браузер не поддерживает обработку камеры');
      const draw = () => {
        if (generation !== this.generation || this.suspended) return;
        if (options.track.readyState === "ended" || options.track.enabled === false) { this.suspend(); return; }
        const w = canvas.width, h = canvas.height, t = this.transform;
        context.resetTransform(); context.fillStyle = '#000'; context.fillRect(0, 0, w, h);
        context.save(); context.translate(w / 2 + t.panX * w, h / 2 + t.panY * h);
        context.rotate(t.rotation * Math.PI / 180); context.scale(t.zoom * (t.flipX ? -1 : 1), t.zoom * (t.flipY ? -1 : 1));
        if (video.readyState >= 2) context.drawImage(video, -w / 2, -h / 2, w, h);
        context.restore();
        if (video.requestVideoFrameCallback) this.callback = video.requestVideoFrameCallback(draw);
        else this.timer = setTimeout(draw, 1000 / Math.min(60, settings.frameRate || 30));
      };
      this.drawFrame = draw;
      draw();
      const stream = canvas.captureStream(Math.min(60, settings.frameRate || 30));
      this.processedTrack = stream.getVideoTracks()[0];
      if (!this.processedTrack) throw new Error('Браузер не поддерживает обработку камеры');
      this.processedTrack.enabled = !this.suspended;
    } catch (error) { await this.destroy(); throw error; }
    finally { if (timeout) clearTimeout(timeout); }
  }
  async restart(options: ProcessorOptions<Track.Kind.Video>) { await this.destroy(); await this.init(options); }
  async destroy() {
    this.generation++;
    this.source?.removeEventListener?.("ended", this.sourceEnded); this.source = undefined; this.drawFrame = undefined;
    if (this.timer) clearTimeout(this.timer);
    if (this.callback !== undefined) this.video?.cancelVideoFrameCallback?.(this.callback);
    this.processedTrack?.stop(); this.processedTrack = undefined;
    if (this.video) { this.video.pause(); this.video.srcObject = null; }
    this.video = undefined; this.canvas = undefined; this.callback = undefined; this.timer = undefined;
  }
}
