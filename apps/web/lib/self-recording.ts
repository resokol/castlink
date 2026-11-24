export type LocalTake = {
  id: string;
  startedAt: number;
  mime: string;
  bytes: number;
  status: "recording" | "complete" | "partial";
};

type Control = { stop(): void };
type Result = { take: LocalTake | null; error: boolean };
type Chunk = { id: string; seq: number; blob: Blob };

const databaseName = "castlink-self-recordings";
const lockName = (id: string) => databaseName + ":" + id;
const chunkRange = (id: string) => IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]);
const maxQueueBytes = 32 * 1024 * 1024;
const maxQueueEvents = 8;
const writeSize = 4 * 1024 * 1024;

export function takeExtension(mime: string): "mp4" | "webm" {
  const type = mime.split(";", 1)[0].trim().toLowerCase();
  if (type === "video/mp4" || type === "audio/mp4") return "mp4";
  if (type === "video/webm" || type === "audio/webm") return "webm";
  throw new Error("recording_format_unsupported");
}

function locks(): LockManager {
  if (!navigator.locks) throw new Error("recording_lock_unavailable");
  return navigator.locks;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") throw new Error("recording_storage_unavailable");
    const open = indexedDB.open(databaseName, 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore("takes", { keyPath: "id" });
      open.result.createObjectStore("chunks", { keyPath: ["id", "seq"] });
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("recording_transaction_aborted"));
  });
}

async function write(db: IDBDatabase, stores: string[], operation: (tx: IDBTransaction) => void) {
  const tx = db.transaction(stores, "readwrite");
  const finished = committed(tx);
  try { operation(tx); }
  catch (error) {
    tx.abort();
    await finished.catch(() => {});
    throw error;
  }
  await finished;
}

async function withDatabase<T>(operation: (db: IDBDatabase) => Promise<T>) {
  const db = await openDatabase();
  try { return await operation(db); }
  finally { db.close(); }
}

function putTake(db: IDBDatabase, take: LocalTake) {
  return write(db, ["takes"], tx => { tx.objectStore("takes").put(take); });
}

function removeTake(db: IDBDatabase, id: string) {
  return write(db, ["takes", "chunks"], tx => {
    tx.objectStore("takes").delete(id);
    tx.objectStore("chunks").delete(chunkRange(id));
  });
}

async function recover(db: IDBDatabase, row: LocalTake): Promise<LocalTake | undefined> {
  if (row.status !== "recording") return row;
  return locks().request(lockName(row.id), { ifAvailable: true }, async lock => {
    if (!lock) return row;
    // An earlier list snapshot can race a normal stop or deletion.
    const tx = db.transaction("takes");
    const found = tx.objectStore("takes").get(row.id);
    await committed(tx);
    const current = found.result as LocalTake | undefined;
    if (current?.status !== "recording") return current;
    if (!current.bytes) {
      await removeTake(db, current.id);
      return undefined;
    }
    const partial: LocalTake = { ...current, status: "partial" };
    // A full disk can still serve the committed prefix.
    await putTake(db, partial).catch(() => {});
    return partial;
  });
}

export function listTakes(): Promise<LocalTake[]> {
  return withDatabase(async db => {
    const tx = db.transaction("takes");
    const rows = tx.objectStore("takes").getAll();
    await committed(tx);
    const result = await Promise.all((rows.result as LocalTake[]).map(row => recover(db, row)));
    return result.filter((row): row is LocalTake => !!row).sort((a, b) => b.startedAt - a.startedAt);
  });
}

export async function readTake(id: string): Promise<Blob> {
  return locks().request(lockName(id), { ifAvailable: true }, lock => {
    if (!lock) throw new Error("recording_active");
    return withDatabase(async db => {
      const tx = db.transaction(["takes", "chunks"]);
      const meta = tx.objectStore("takes").get(id);
      const parts = tx.objectStore("chunks").getAll(chunkRange(id));
      await committed(tx);
      const take = meta.result as LocalTake | undefined;
      if (!take?.bytes) throw new Error("recording_no_data");
      const blob = new Blob((parts.result as Chunk[]).map(part => part.blob), { type: take.mime });
      if (blob.size !== take.bytes) throw new Error("recording_data_incomplete");
      return blob;
    });
  });
}

export async function deleteTake(id: string): Promise<void> {
  return locks().request(lockName(id), { ifAvailable: true }, lock => {
    if (!lock) throw new Error("recording_active");
    return withDatabase(db => removeTake(db, id));
  });
}

function formats(video: boolean) {
  const candidates = video
    ? ["video/mp4;codecs=avc1.42E028,mp4a.40.2", "video/mp4", "video/webm;codecs=vp8,opus", "video/webm"]
    : ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
  return candidates.filter(mime => !MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(mime));
}

// A fragmented MP4 may emit its file/track headers well before the first samples.
// Don't publish an empty take if the page closes in that interval.
async function mp4HeadersOnly(blob: Blob) {
  if (blob.size < 8 || blob.size > 64 * 1024) return false;
  const bytes = new DataView(await blob.arrayBuffer());
  let offset = 0;
  while (offset + 8 <= bytes.byteLength) {
    const type = bytes.getUint32(offset + 4);
    if (type !== 0x66747970 && type !== 0x6d6f6f76) return false; // ftyp, moov
    const size = bytes.getUint32(offset);
    if (size < 8) return false;
    offset += size;
  }
  return offset === bytes.byteLength;
}

async function capture(db: IDBDatabase, id: string, stream: MediaStream, started: (control: Control) => void): Promise<Result> {
  const tracks = stream.getTracks().filter(track => track.readyState === "live");
  if (!tracks.length || typeof MediaRecorder === "undefined") throw new Error("recording_unavailable");
  const choices = formats(tracks.some(track => track.kind === "video"));
  if (!choices.length) throw new Error("recording_format_unsupported");
  const input = new MediaStream(tracks);
  let take: LocalTake = { id, startedAt: Date.now(), mime: choices[0], bytes: 0, status: "recording" };
  await write(db, ["takes"], tx => { tx.objectStore("takes").add(take); });

  let recorder: MediaRecorder;
  let seq = 0, pendingBytes = 0, queued = 0;
  let interrupted = false, discard = false, writeFailed = false, stopping = false, ended = false;
  let pending: Promise<void> = Promise.resolve();
  let headers: Blob | undefined;
  let finish!: () => void;
  const stopped = new Promise<void>(resolve => { finish = resolve; });
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const onStop = () => {
    if (!stopping) interrupted = true;
    ended = true;
    clearTimeout(watchdog);
    finish();
  };
  const stop = () => {
    if (ended || stopping) return;
    stopping = true;
    // An errored implementation may omit its final stop event.
    watchdog = setTimeout(() => { interrupted = true; onStop(); }, 10_000);
    try { if (recorder.state !== "inactive") recorder.stop(); }
    catch { interrupted = true; }
  };
  const interrupt = () => { interrupted = true; stop(); };
  const append = async (blob: Blob, mime: string) => {
    if (take.bytes && takeExtension(take.mime) !== takeExtension(mime)) throw new Error("recording_format_changed");
    takeExtension(mime);
    // After sleep the browser can deliver a large single Blob. Persist it in bounded transactions.
    for (let offset = 0; offset < blob.size; offset += writeSize) {
      const piece = blob.slice(offset, offset + writeSize);
      const updated = { ...take, mime, bytes: take.bytes + piece.size };
      await write(db, ["chunks", "takes"], tx => {
        tx.objectStore("chunks").add({ id, seq, blob: piece } satisfies Chunk);
        tx.objectStore("takes").put(updated);
      });
      take = updated;
      seq++;
    }
  };
  const onData = (event: BlobEvent) => {
    const blob = event.data;
    if (ended || discard || writeFailed || !blob.size) return;
    if (queued && (queued >= maxQueueEvents || pendingBytes + blob.size > maxQueueBytes)) {
      discard = true;
      interrupt();
      return;
    }
    queued++;
    pendingBytes += blob.size;
    const mime = blob.type || recorder.mimeType || take.mime;
    pending = pending.then(async () => {
      if (writeFailed) return;
      try {
        if (!take.bytes && takeExtension(mime) === "mp4" && await mp4HeadersOnly(blob)) {
          headers = headers ? new Blob([headers, blob]) : blob;
          return;
        }
        await append(headers ? new Blob([headers, blob]) : blob, mime);
        headers = undefined;
      }
      catch { writeFailed = true; interrupt(); }
    }).finally(() => { queued--; pendingBytes -= blob.size; });
  };

  let running = false;
  try {
    let failure: unknown = new Error("recording_format_unsupported");
    for (const mime of choices) {
      try {
        const options = { mimeType: mime, videoKeyFrameIntervalDuration: 1000 };
        recorder = new MediaRecorder(input, options);
        recorder.ondataavailable = onData;
        recorder.onstop = onStop;
        recorder.onerror = interrupt;
        recorder.start(1000);
        take = { ...take, mime: recorder.mimeType || mime };
        running = true;
        break;
      } catch (error) {
        failure = error;
        if (!(error instanceof DOMException) || error.name !== "NotSupportedError") throw error;
      }
    }
    if (!running) throw failure;
    window.addEventListener("pagehide", interrupt);
    for (const track of tracks) track.addEventListener("ended", interrupt);
    started({ stop });
    await stopped;
    await pending;
    if (!take.bytes) {
      await removeTake(db, id).catch(() => {});
      return { take: null, error: true };
    }
    take = { ...take, status: interrupted ? "partial" : "complete" };
    try { await putTake(db, take); }
    catch { return { take: { ...take, status: "partial" }, error: true }; }
    return { take, error: interrupted };
  } catch (error) {
    if (!running) await removeTake(db, id).catch(() => {});
    throw error;
  } finally {
    clearTimeout(watchdog);
    window.removeEventListener("pagehide", interrupt);
    for (const track of tracks) track.removeEventListener("ended", interrupt);
  }
}

export async function startLocalRecording(stream: MediaStream, onFinish: (take: LocalTake | null, error: boolean) => void): Promise<Control> {
  const manager = locks();
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    let running = false;
    // Hold ownership until the last chunk AND metadata transaction commit. Crashes automatically release it.
    void manager.request(lockName(id), () => withDatabase(db => capture(db, id, stream, control => {
      running = true;
      resolve(control);
    }))).then(result => onFinish(result.take, result.error), error => {
      if (running) onFinish(null, true);
      else reject(error);
    });
  });
}
