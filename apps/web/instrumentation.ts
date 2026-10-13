export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validatePersistentStorage } = await import("./lib/persistent-storage");
    await validatePersistentStorage();
    const { validateRoomStore } = await import("./lib/room-store");
    await validateRoomStore();
    const { startReserveHeartbeatWorker } = await import("./lib/reserve-heartbeat-worker");
    startReserveHeartbeatWorker();
  }
}
