export type PresentationFrame = HTMLCanvasElement | HTMLVideoElement;

export const FRAME_WIDTH = 1920;
export const FRAME_HEIGHT = 1080;
export const SLIDE_WIDTH = 1485;
const CAMERA_LEFT = SLIDE_WIDTH + 24;

function fit(context: CanvasRenderingContext2D, source: PresentationFrame, x: number, width: number) {
  const video = source instanceof HTMLVideoElement;
  if (video && source.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
  const w = video ? source.videoWidth : source.width;
  const h = video ? source.videoHeight : source.height;
  if (!w || !h) return;
  const scale = Math.min(width / w, FRAME_HEIGHT / h);
  const drawWidth = Math.round(w * scale);
  const drawHeight = Math.round(h * scale);
  context.drawImage(source, x + Math.round((width - drawWidth) / 2), Math.round((FRAME_HEIGHT - drawHeight) / 2), drawWidth, drawHeight);
}

/** The same canvas is the speaker's monitor and the video encoder input. */
export function previewFrames(canvas: HTMLCanvasElement, camera: HTMLVideoElement, presentation: () => PresentationFrame | null) {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw Error("Canvas unavailable");
  const draw = () => {
    const slide = presentation();
    context.fillStyle = "#101316";
    context.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    if (slide) {
      fit(context, slide, 0, SLIDE_WIDTH);
      fit(context, camera, CAMERA_LEFT, FRAME_WIDTH - CAMERA_LEFT);
    } else {
      fit(context, camera, 0, FRAME_WIDTH);
    }
  };
  draw();
  // A speaker can switch to PowerPoint during a take. rAF pauses in hidden tabs.
  // Schedule the next tick only after drawing, so suspended pages never build a backlog.
  const clock = new Worker(new URL("./self-recording-clock.js", import.meta.url));
  clock.onmessage = () => { draw(); clock.postMessage(null); };
  clock.postMessage(null);
  return () => clock.terminate();
}
