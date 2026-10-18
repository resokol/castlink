type CaptureDevices = Pick<MediaDevices, "getUserMedia"> & Partial<Pick<MediaDevices, "getDisplayMedia">>;
export type GuestCaptureScope = {
  readonly closed: boolean;
  stop(): void;
  drain(): Promise<void>;
  dispose(): void;
};

/** Own this guest page's raw captures, including a browser picker still awaiting a decision. */
export function createGuestCaptureScope(devices: CaptureDevices): GuestCaptureScope {
  let closed = false;
  const tracks = new Set<MediaStreamTrack>();
  const pending = new Set<Promise<MediaStream>>();
  const originals = new Map<"getUserMedia" | "getDisplayMedia", (...args: any[]) => Promise<MediaStream>>();
  const wrappers = new Map<"getUserMedia" | "getDisplayMedia", (...args: any[]) => Promise<MediaStream>>();
  const stop = () => {
    closed = true;
    const failures: unknown[] = [];
    for (const track of tracks) {
      try { track.enabled = false; if (track.readyState !== "ended") track.stop(); } catch (error) { failures.push(error); }
    }
    if (failures.length) throw new AggregateError(failures, "Не удалось остановить устройства гостя.");
  };
  for (const name of ["getUserMedia", "getDisplayMedia"] as const) {
    const original = devices[name];
    if (typeof original !== "function") continue;
    originals.set(name, original);
    const wrapped = (...args: any[]) => {
      if (closed) return Promise.reject(new Error("Передача гостя завершается."));
      // Invoke before any await: getDisplayMedia must retain the user's gesture.
      const operation = Promise.resolve(original.apply(devices, args as [any])).then(stream => {
        for (const track of tracks) if (track.readyState === "ended") tracks.delete(track);
        for (const track of stream.getTracks()) tracks.add(track);
        if (closed) { stop(); throw new Error("Передача гостя завершается."); }
        return stream;
      });
      pending.add(operation);
      void operation.finally(() => pending.delete(operation)).catch(() => undefined);
      return operation;
    };
    wrappers.set(name, wrapped);
    devices[name] = wrapped;
  }
  return {
    get closed() { return closed; },
    stop,
    async drain() {
      while (pending.size) await Promise.allSettled(Array.from(pending));
      stop();
      if (Array.from(tracks).some(track => track.readyState !== "ended")) throw new Error("Не удалось остановить устройства гостя.");
    },
    dispose() {
      try { stop(); }
      finally { for (const [name, original] of originals) if (devices[name] === wrappers.get(name)) devices[name] = original; }
    },
  };
}

type GuestTrack = { mediaStreamTrack: MediaStreamTrack; stop(): void };
type TransitionRoom = {
  state: string;
  localParticipant: { trackPublications: Map<unknown, { track?: GuestTrack }> };
  disconnect(stopTracks?: boolean): Promise<unknown>;
};

/** Accept the role while connected; call this only after its server acknowledgement. */
export async function transitionGuestToStaff({ room, captureScope, panelPath, origin, studioId, roomName, quiesce, drain, navigate, current = () => true, timeoutMs = 10000 }: {
  room: TransitionRoom; captureScope: GuestCaptureScope; panelPath: string; origin: string; studioId: string; roomName: string;
  quiesce(): void | Promise<unknown>; drain(): Promise<unknown>; navigate(path: string): void; current?(): boolean; timeoutMs?: number;
}) {
  let panel: URL;
  try { panel = new URL(panelPath, origin); } catch { throw new Error("Некорректный адрес панели."); }
  if (panel.origin !== origin || !["/admin", "/moderator"].includes(panel.pathname) || panel.username || panel.password || panel.hash || panel.searchParams.get("studioId") !== studioId || panel.searchParams.get("room") !== roomName) throw new Error("Некорректный адрес панели.");
  const stopped = new Set<MediaStreamTrack>();
  const stopPublications = () => {
    const errors: unknown[] = [];
    for (const publication of room.localParticipant.trackPublications.values()) if (publication.track) {
      const media = publication.track.mediaStreamTrack;
      stopped.add(media);
      try { media.enabled = false; media.stop(); publication.track.stop(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "Не удалось остановить передачу гостя.");
  };
  const quiesced = quiesce();
  try { captureScope.stop(); } finally { stopPublications(); }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = async () => {
    await room.disconnect(true);
    await Promise.all([quiesced, drain(), captureScope.drain()]);
    stopPublications();
    await room.disconnect(true);
    await captureScope.drain();
    if (String(room.state) !== "disconnected" || Array.from(stopped).some(track => track.readyState !== "ended")) throw new Error("Не удалось подтвердить остановку передачи гостя.");
  };
  try {
    await Promise.race([cleanup(), new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("Завершите выбор устройства или экрана и повторите переход в панель.")), timeoutMs); })]);
  } finally { if (timer) clearTimeout(timer); }
  if (!current()) throw new Error("Переход отменён.");
  navigate(`${panel.pathname}${panel.search}`);
}
