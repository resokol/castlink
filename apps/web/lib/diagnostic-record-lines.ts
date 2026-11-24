import type { Readable } from "node:stream";

/** Split bytes before decoding so a broken archive cannot allocate an unbounded line. */
export async function* storedLines(input: Readable, signal: AbortSignal, maxLineBytes = 2 * 1024 * 1024) {
  let parts: Buffer[] = [], length = 0;
  for await (const chunk of input) {
    signal.throwIfAborted();
    const bytes = chunk as Buffer;
    let start = 0;
    while (start < bytes.length) {
      const newline = bytes.indexOf(10, start);
      const end = newline === -1 ? bytes.length : newline;
      const segment = bytes.subarray(start, end);
      length += segment.length;
      if (length > maxLineBytes) parts = [];
      else if (segment.length) parts.push(segment);
      if (newline === -1) break;
      yield length <= maxLineBytes ? (parts.length === 1 ? parts[0] : Buffer.concat(parts, length)).toString("utf8") : null;
      parts = []; length = 0; start = newline + 1;
    }
  }
  if (length) yield null; // Interrupted append. A complete stored JSONL record always ends in LF.
}
