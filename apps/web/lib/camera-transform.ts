export type CameraTransform = { zoom: number; panX: number; panY: number; rotation: number; flipX: boolean; flipY: boolean };
export const DEFAULT_CAMERA_TRANSFORM: CameraTransform = { zoom: 1, panX: 0, panY: 0, rotation: 0, flipX: false, flipY: false };
export function parseCameraTransform(value: unknown): CameraTransform | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(key => !(key in DEFAULT_CAMERA_TRANSFORM))) return;
  for (const [key, min, max] of [['zoom', 1, 5], ['panX', -1, 1], ['panY', -1, 1], ['rotation', -180, 180]] as const) if (typeof v[key] !== 'number' || !Number.isFinite(v[key]) || v[key] < min || v[key] > max) return;
  if (typeof v.flipX !== 'boolean' || typeof v.flipY !== 'boolean') return;
  return { zoom: v.zoom as number, panX: v.panX as number, panY: v.panY as number, rotation: v.rotation as number, flipX: v.flipX, flipY: v.flipY };
}
export function sameCameraTransform(a: CameraTransform, b: CameraTransform) { return Object.keys(DEFAULT_CAMERA_TRANSFORM).every(key => a[key as keyof CameraTransform] === b[key as keyof CameraTransform]); }
export function identityCameraTransform(value: CameraTransform) { return sameCameraTransform(value, DEFAULT_CAMERA_TRANSFORM); }
