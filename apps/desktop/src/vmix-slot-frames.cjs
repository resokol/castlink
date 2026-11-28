'use strict';

const asBuffer = bytes => Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);

function createSlotFrames({ width, height, fps, sink }) {
  const pixels = width * height;
  const black = Buffer.alloc(pixels * 3 / 2, 128);
  black.fill(16, 0, pixels);
  const pcmBytes = 48_000 * 2 * 2 / fps;
  if (!Number.isInteger(pcmBytes) || pcmBytes % 4) throw new Error('VMIX_AUDIO_CLOCK');
  let latest, cached, queuedBytes = 0;
  const queue = [];

  function scale(frame, rotation) {
    const data = asBuffer(frame.data);
    if (!rotation && frame.width === width && frame.height === height) return data;
    const quarterTurn = rotation === 90 || rotation === 270;
    const displayWidth = quarterTurn ? frame.height : frame.width;
    const displayHeight = quarterTurn ? frame.width : frame.height;
    const ratio = Math.min(width / displayWidth, height / displayHeight);
    const w = Math.max(2, Math.floor(displayWidth * ratio / 2) * 2);
    const h = Math.max(2, Math.floor(displayHeight * ratio / 2) * 2);
    const left = Math.floor((width - w) / 4) * 2;
    const top = Math.floor((height - h) / 4) * 2;
    const result = Buffer.from(black);
    const inPixels = frame.width * frame.height;
    for (const plane of [0, 1, 2]) {
      const divisor = plane ? 2 : 1;
      const inputWidth = Math.ceil(frame.width / divisor);
      const inputHeight = Math.ceil(frame.height / divisor);
      const planeWidth = quarterTurn ? inputHeight : inputWidth;
      const planeHeight = quarterTurn ? inputWidth : inputHeight;
      const outputWidth = width / divisor;
      const columns = w / divisor;
      const rows = h / divisor;
      const inputStart = !plane ? 0 : inPixels + (plane - 1) * inputWidth * inputHeight;
      const outputStart = (!plane ? 0 : pixels + (plane - 1) * pixels / 4) + outputWidth * top / divisor + left / divisor;
      const indices = Int32Array.from({ length: columns }, (_, column) => {
        const x = Math.floor(column * planeWidth / columns);
        if (rotation === 90) return (inputHeight - 1 - x) * inputWidth;
        if (rotation === 270) return x * inputWidth;
        return rotation === 180 ? inputWidth - 1 - x : x;
      });
      for (let row = 0; row < rows; row++) {
        const y = Math.floor(row * planeHeight / rows);
        const from = inputStart + (quarterTurn ? (rotation === 90 ? y : inputWidth - 1 - y) :
          (rotation === 180 ? inputHeight - 1 - y : y) * inputWidth);
        const to = outputStart + row * outputWidth;
        for (let column = 0; column < columns; column++) result[to + column] = data[from + indices[column]];
      }
    }
    return result;
  }

  function clearVideo() { latest = cached = undefined; }
  function clearAudio() { queue.length = 0; queuedBytes = 0; }

  return {
    video(frame, rotation = 0) {
      if (!frame.width || !frame.height || frame.data.byteLength !== frame.width * frame.height +
          2 * Math.ceil(frame.width / 2) * Math.ceil(frame.height / 2)) return;
      latest = { frame, rotation };
      cached = undefined;
    },
    audio(data) {
      if (!data.byteLength) return;
      const samples = asBuffer(data);
      queue.push(samples);
      queuedBytes += samples.length;
      while (queuedBytes > pcmBytes * 4) queuedBytes -= queue.shift().length;
    },
    clearVideo,
    clearAudio,
    clear() { clearVideo(); clearAudio(); },
    write() {
      if (latest && !cached) cached = scale(latest.frame, latest.rotation);
      sink.writeVideo(cached || black);
      const pcm = Buffer.alloc(pcmBytes);
      let used = 0;
      while (used < pcm.length && queue.length) {
        const count = queue[0].copy(pcm, used, 0, pcm.length - used);
        used += count;
        queuedBytes -= count;
        if (count === queue[0].length) queue.shift();
        else queue[0] = queue[0].subarray(count);
      }
      sink.writeAudio(pcm);
    },
  };
}

module.exports = { createSlotFrames };
