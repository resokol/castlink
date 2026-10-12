import type { Room } from "livekit-client";

type Request = { deviceId: string; pending: boolean; promise: Promise<boolean> };
type Queue = { tail: Promise<unknown>; latest?: Request };
const roomQueues = new WeakMap<Room, Queue>();
const elementQueues = new WeakMap<HTMLMediaElement, Queue>();
const normalized = (value?: string) => !value || value === "default" ? "default" : value;

function enqueue(queue: Queue, deviceId: string, apply: () => Promise<void>) {
  if (queue.latest?.pending && queue.latest.deviceId === deviceId) return queue.latest.promise;
  const request: Request = { deviceId, pending: true, promise: Promise.resolve(false) };
  request.promise = queue.tail.catch(() => undefined).then(async () => {
    if (queue.latest !== request) return false;
    try { await apply(); }
    catch (error) { if (queue.latest !== request) return false; throw error; }
    return queue.latest === request;
  }).finally(() => { request.pending = false; });
  queue.latest = request; queue.tail = request.promise;
  return request.promise;
}

function roomOutput(room: Room, deviceId: string) {
  let queue = roomQueues.get(room);
  if (!queue) { queue = { tail: Promise.resolve() }; roomQueues.set(room, queue); }
  return enqueue(queue, deviceId, async () => {
    if (room.state !== "connected") return;
    if (normalized(room.getActiveDevice("audiooutput")) === deviceId &&
      normalized(room.options.audioOutput?.deviceId) === deviceId) return;
    // The SDK owns RemoteAudioTrack.attachedElements and also restores their sink during attach.
    if (await room.switchActiveDevice("audiooutput", deviceId) === false) throw new Error("Браузер не подтвердил выбранный выход звука.");
  });
}

function sdkElements(room?: Room) {
  const elements = new Set<HTMLMediaElement>();
  for (const participant of room?.remoteParticipants.values() ?? []) {
    for (const publication of participant.trackPublications.values()) {
      for (const element of publication.track?.attachedElements ?? []) elements.add(element);
    }
  }
  return elements;
}

function localOutput(element: HTMLMediaElement, deviceId: string) {
  let queue = elementQueues.get(element);
  if (!queue) { queue = { tail: Promise.resolve() }; elementQueues.set(element, queue); }
  return enqueue(queue, deviceId, async () => {
    if (element.isConnected === false || normalized(element.sinkId) === deviceId) return;
    await element.setSinkId(deviceId);
    if (normalized(element.sinkId) !== deviceId) throw new Error("Браузер не подтвердил выбранный выход звука.");
  });
}

/** SDK-owned remote elements have one writer; local monitor elements have a serialized writer. */
export async function applyAudioOutput(room: Room | undefined, outputId: string, elements: HTMLMediaElement[], newChoice = true) {
  const deviceId = normalized(outputId);
  // Reconnect/DOM events from another mounted chooser must not restore its obsolete choice.
  const desired = room ? roomQueues.get(room)?.latest : undefined;
  if (!newChoice && desired && desired.deviceId !== deviceId) return false;
  if (!newChoice && !room && elements.some(element => {
    const latest = elementQueues.get(element)?.latest;
    return latest && latest.deviceId !== deviceId;
  })) return false;
  if (room && !await roomOutput(room, deviceId)) return false;
  const owned = sdkElements(room);
  const results = await Promise.all(elements.filter(element => !owned.has(element)).map(element => localOutput(element, deviceId)));
  return results.every(Boolean);
}
