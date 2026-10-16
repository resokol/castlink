import { validateImageTransform, type ImageTransform, imageTransformStyle } from './multiview-image';
/** Presentation only: never touches capture, sender tracks, codecs or caster consent. */
export function participantStudioImageTransform(metadata?: string): ImageTransform {
  try { const value = JSON.parse(metadata || '{}').studioImageTransform; return value === undefined ? {} : validateImageTransform(value); } catch { return {}; }
}
export function applyStudioImageTransform(video: Pick<HTMLVideoElement, 'style'>, metadata?: string) {
  Object.assign(video.style, imageTransformStyle(participantStudioImageTransform(metadata)));
}
