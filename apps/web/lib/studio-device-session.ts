export function studioDeviceStorage(): Storage | undefined {
  try { return typeof window === "undefined" ? undefined : window.localStorage; } catch { return undefined; }
}
export type StudioDeviceChoices = { videoDeviceId: string; audioDeviceId: string; outputDeviceId: string };
const defaults = (): StudioDeviceChoices => ({ videoDeviceId: '', audioDeviceId: '', outputDeviceId: 'default' });
const storageKey = (studioId: string) => `castlink-studio-devices:${studioId}`;
export function readStudioDeviceChoices(storage: Pick<Storage, 'getItem'> | undefined, studioId: string): StudioDeviceChoices {
  try {
    const value = JSON.parse(storage?.getItem(storageKey(studioId)) || 'null');
    const choices = defaults();
    if (value && typeof value === 'object') for (const key of Object.keys(choices) as (keyof StudioDeviceChoices)[]) {
      if (typeof value[key] === 'string' && value[key].length <= 1024) choices[key] = value[key];
    }
    return choices;
  } catch { return defaults(); }
}
export function saveStudioDeviceChoices(storage: Pick<Storage, 'setItem'> | undefined, studioId: string, choices: StudioDeviceChoices) {
  try { storage?.setItem(storageKey(studioId), JSON.stringify(choices)); } catch { /* Private mode may disable storage. */ }
}
type PublishedTrack = { mediaStreamTrack: MediaStreamTrack; replaceTrack: (track: MediaStreamTrack, userProvidedTrack?: boolean) => Promise<unknown>; simulcastCodecs?: Map<unknown, { mediaStreamTrack: MediaStreamTrack; sender?: RTCRtpSender }> };
export class StudioTrackRollbackError extends AggregateError {
  constructor(errors: unknown[]) {
    super(errors, 'Не удалось восстановить устройства Studio Return');
    this.name = 'StudioTrackRollbackError';
  }
}
/** Keep the current capture alive until all senders accept the replacement. */
export async function replaceStudioPublishedTracks(published: { video?: PublishedTrack; audio?: PublishedTrack }, stream: MediaStream) {
  const changes: { restore: () => Promise<unknown>; dispose?: () => void }[] = [];
  const disposePrevious: (() => void)[] = [];
  try {
    for (const kind of ['video', 'audio'] as const) {
      const local = published[kind];
      const next = kind === 'video' ? stream.getVideoTracks()[0] : stream.getAudioTracks()[0];
      if (!local || !next || next.readyState !== 'live') throw new Error('Нет видео или аудио Studio Return');
      const previous = local.mediaStreamTrack;
      // The SDK can throw after swapping the sender, so register rollback first.
      changes.push({ restore: () => local.replaceTrack(previous, true) });
      await local.replaceTrack(next, true);
      if (kind === 'video') for (const backup of local.simulcastCodecs?.values() || []) {
        const previousBackup = backup.mediaStreamTrack;
        const clone = next.clone();
        changes.push({ restore: async () => { await backup.sender?.replaceTrack(previousBackup); backup.mediaStreamTrack = previousBackup; }, dispose: () => clone.stop() });
        await backup.sender?.replaceTrack(clone);
        backup.mediaStreamTrack = clone;
        disposePrevious.push(() => previousBackup.stop());
      }
    }
  } catch (cause) {
    const failures = [];
    for (const change of changes.reverse()) {
      try { await change.restore(); } catch (error) { failures.push(error); }
      finally { change.dispose?.(); }
    }
    if (failures.length) throw new StudioTrackRollbackError([cause, ...failures]);
    throw cause;
  }
  disposePrevious.forEach(dispose => dispose());
}
