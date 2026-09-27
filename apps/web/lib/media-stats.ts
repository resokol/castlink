// A closed/reconnecting peer must not permanently stall the next collection cycle.
export async function readTrackStats(track: any, method: "getRTCStatsReport" | "getSenderStats", timeoutMs = 1500): Promise<any> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => track[method]()),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Превышено время ожидания статистики WebRTC")), timeoutMs); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}
