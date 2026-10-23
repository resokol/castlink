import { conferenceGalleryLayout } from './conference-gallery-layout';

export type SceneSource = { id: string; identity: string; kind: 'camera' | 'screen' };
export type SpeakerState = { selected: string; candidate: string; since: number };
export const SPEAKER_HOLD_MS = 1000;

/** Presentation state is local layout state, never a media or subscription command. */
export function advanceSpeaker(previous: SpeakerState, active: readonly string[], available: readonly string[], now: number): SpeakerState {
  const selected = available.includes(previous.selected) ? previous.selected : available[0] || '';
  const candidate = active.find(identity => available.includes(identity));
  if (!candidate || candidate === selected) return { selected, candidate: '', since: 0 };
  if (previous.candidate !== candidate) return { selected, candidate, since: now };
  return now - previous.since >= SPEAKER_HOLD_MS ? { selected: candidate, candidate: '', since: 0 } : { ...previous, selected };
}

export function primarySceneSource(items: readonly SceneSource[], speaker: string, previous: string, pinned?: string): string {
  const screens = items.filter(item => item.kind === 'screen');
  if (screens.length) return (screens.find(item => item.id === previous) || screens[0]).id;
  return (items.find(item => item.id === pinned) || items.find(item => item.identity === speaker) || items.find(item => item.id === previous) || items[0])?.id || '';
}

export function sceneSplit(value: number): number { return Number.isFinite(value) ? Math.max(0.5, Math.min(0.88, value)) : 0.76; }

/** Desktop fits the stage; portrait mobile keeps readable two-column rows. */
export function sceneGallery(count: number, width: number, height: number, portraitMobile = false) {
  const gap = 8;
  width = Math.max(1, width); height = Math.max(1, height);
  const { columns, rows } = portraitMobile
    ? { columns: count > 1 ? 2 : 1, rows: Math.max(1, Math.ceil(count / 2)) }
    : conferenceGalleryLayout(count, width, height, gap);
  const rowWidth = (width - gap * (columns - 1)) / columns;
  const tileWidth = portraitMobile ? rowWidth : Math.min(rowWidth, (height - gap * (rows - 1)) / rows * 16 / 9);
  return { columns, rows, tileWidth: Math.max(1,tileWidth), tileHeight: Math.max(1,tileWidth) * 9 / 16 };
}

/** Filmstrip thumbnails keep their shape independently of the number of participants. */
export function sceneRail(width: number, height: number, count: number, split: number, portrait: boolean) {
  const tileHeight = portrait ? Math.max(64, Math.min(144, height * (1 - split) - 8)) : Math.max(130, (width - 12) * (1 - split)) * 9 / 16;
  const tileWidth = tileHeight * 16 / 9;
  return { tileWidth, tileHeight, mainHeight: Math.max(100, height - tileHeight - 12 - 16),
    width: portrait ? Math.max(width, count * (tileWidth + 8) - 8) : width,
    height: portrait ? height : Math.max(height, count * (tileHeight + 8) - 8) };
}
