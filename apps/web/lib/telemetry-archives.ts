import { randomUUID } from "node:crypto";
import { open, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { createGunzip, gzip } from "node:zlib";
import { promisify } from "node:util";

export const STATS_HOUR = 3_600_000;
const compress = promisify(gzip);
type ArchiveIndex = { rawBytes: number; members: { rawOffset: number; gzipOffset: number }[] };
export type TelemetryHour = { hour: number; raw?: string; gzip?: string; index?: string };

export function statsRetentionDays() {
  const days = Number(process.env.STUDIOLINK_STATS_RETENTION_DAYS);
  return Number.isInteger(days) && days >= 1 && days <= 90 ? days : 30;
}
export function statsMaxBytes() {
  const bytes = Number(process.env.STUDIOLINK_STATS_MAX_BYTES);
  return Number.isSafeInteger(bytes) && bytes >= 64 * 1024 * 1024 ? bytes : 512 * 1024 * 1024;
}
export function historyEnd(value?: number) {
  const to = value ?? Date.now();
  if (!Number.isSafeInteger(to) || to > Date.now() + 1000 || to < Date.now() - statsRetentionDays() * 24 * STATS_HOUR) throw new Error("invalid_audio_end");
  return to;
}

export async function telemetryHours(directory: string): Promise<TelemetryHour[]> {
  let files: string[];
  try { files = await readdir(directory); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  const hours = new Map<number, TelemetryHour>();
  for (const file of files) {
    const match = /^(\d+)\.(jsonl|jsonl\.gz|idx\.json)$/.exec(file);
    if (!match) continue;
    const hour = Number(match[1]), value = hours.get(hour) ?? { hour };
    value[match[2] === "jsonl" ? "raw" : match[2] === "jsonl.gz" ? "gzip" : "index"] = path.join(directory, file);
    hours.set(hour, value);
  }
  return [...hours.values()].filter(hour => hour.raw || hour.gzip).sort((a, b) => a.hour - b.hour);
}

/** Gzip members start at line boundaries so a page need decode at most 1 MiB before its cursor. */
export async function archiveTelemetryHour(hour: TelemetryHour) {
  if (!hour.raw) return;
  const archive = hour.raw + ".gz", indexPath = hour.raw.replace(/\.jsonl$/, ".idx.json");
  const temporary = archive + `.${randomUUID()}.tmp`, temporaryIndex = indexPath + `.${randomUUID()}.tmp`;
  let output: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const originalSize = (await stat(hour.raw)).size;
    if (!originalSize) return;
    if (hour.gzip && hour.index) {
      const existing: ArchiveIndex = JSON.parse(await readFile(hour.index, "utf8"));
      if (existing.rawBytes === originalSize) { await unlink(hour.raw); return; }
    }
    output = await open(temporary, "wx", 0o600);
    const inputHandle = await open(hour.raw, "r"), input = inputHandle.createReadStream();
    const lines = createInterface({ input, crlfDelay: Infinity });
    const index: ArchiveIndex = { rawBytes: 0, members: [] };
    let chunks: Buffer[] = [], chunkBytes = 0, gzipOffset = 0;
    const flush = async () => {
      if (!chunkBytes) return;
      index.members.push({ rawOffset: index.rawBytes, gzipOffset });
      const encoded = await compress(Buffer.concat(chunks), { level: 6 });
      await output!.writeFile(encoded);
      index.rawBytes += chunkBytes; gzipOffset += encoded.length; chunks = []; chunkBytes = 0;
    };
    try {
      for await (const line of lines) {
        const chunk = Buffer.from(line + "\n", "utf8");
        if (chunkBytes && chunkBytes + chunk.length > 1024 * 1024) await flush();
        chunks.push(chunk); chunkBytes += chunk.length;
      }
      await flush();
    } finally { lines.close(); input.destroy(); }
    if (index.rawBytes !== originalSize || (await stat(hour.raw)).size !== originalSize) throw new Error("stats_archive_changed");
    await output.sync(); await output.close(); output = undefined;
    await writeFile(temporaryIndex, JSON.stringify(index), { flag: "wx", mode: 0o600 });
    // Readers prefer raw until gzip is published; raw is removed only after both archive files exist.
    await rename(temporaryIndex, indexPath);
    await rename(temporary, archive);
    await unlink(hour.raw);
  } catch {
    // Compression/storage failures leave the complete raw source available.
  } finally {
    await output?.close().catch(() => undefined);
    await unlink(temporary).catch(() => undefined); await unlink(temporaryIndex).catch(() => undefined);
  }
}

/** Open a logical hour once. A raw file descriptor remains valid if cleanup archives it mid-read. */
export async function openTelemetryHour(hour: TelemetryHour, offset = 0) {
  if (hour.raw) {
    try {
      const handle = await open(hour.raw, "r");
      const size = (await handle.stat()).size;
      if (offset > size) { await handle.close(); throw new Error("invalid_audio_cursor"); }
      const input = handle.createReadStream({ start: offset });
      return { input, start: offset, close: () => input.destroy() };
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  const base = hour.raw?.replace(/\.jsonl$/, "") ?? hour.gzip!.replace(/\.jsonl\.gz$/, "");
  const index: ArchiveIndex = JSON.parse(await readFile(base + ".idx.json", "utf8"));
  if (!Array.isArray(index.members) || !Number.isSafeInteger(index.rawBytes) || offset > index.rawBytes) throw new Error("invalid_audio_cursor");
  const member = [...index.members].reverse().find(item => item.rawOffset <= offset) ?? { rawOffset: 0, gzipOffset: 0 };
  const handle = await open(base + ".jsonl.gz", "r"), source = handle.createReadStream({ start: member.gzipOffset });
  const input = createGunzip();
  source.on("error", error => input.destroy(error)); source.pipe(input);
  return { input, start: member.rawOffset, close: () => { source.destroy(); input.destroy(); } };
}
