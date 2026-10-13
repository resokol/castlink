/** Merge configured inventory with node observations; observation is not a DB mutation. */
export function mergePlatformTopology(studios: any[], registryRooms: any[], snapshots: any[], now = Date.now()) {
  const studioMap = new Map<string, any>(studios.map(studio => [studio.studioId, { ...studio, observedLive: false, observedNodeIds: [] as string[] }]));
  const rooms = new Map<string, any>();
  for (const snapshot of snapshots) {
    if (!snapshot.ok) continue;
    for (const room of snapshot.rooms || []) {
      if (typeof room.mediaRoom !== "string") continue;
      const studioId = typeof room.studioId === "string" ? room.studioId : null;
      if (studioId && !studioMap.has(studioId)) studioMap.set(studioId, {
        studioId, organizationId: null, name: studioId, assignmentMode: "observed", assignedNodeId: snapshot.nodeId,
        broadcastState: "idle", observedLive: false, observedNodeIds: [] as string[],
      });
      const studio = studioId ? studioMap.get(studioId) : undefined;
      if (studio && !studio.observedNodeIds.includes(snapshot.nodeId)) studio.observedNodeIds.push(snapshot.nodeId);
      if (studio && room.onAir === true) studio.observedLive = true;
      rooms.set(`${snapshot.nodeId}:${room.mediaRoom}`, {
        roomId: `${snapshot.nodeId}:${room.mediaRoom}`, studioId, organizationId: studio?.organizationId || null,
        name: room.name || room.mediaRoom, nodeId: snapshot.nodeId, mediaRoom: room.mediaRoom,
        updatedAt: snapshot.generatedAt || now, participants: Array.isArray(room.participants) ? room.participants : [],
        participantCount: Number.isSafeInteger(room.participantCount) ? room.participantCount : null,
        topologyAvailable: room.topologyAvailable !== false, topologyError: room.error || null, nodeLatencyMs: snapshot.latencyMs, onAir: room.onAir === true,
        origin: room.configured ? "node-store" : "live-only",
      });
    }
  }
  for (const room of registryRooms) {
    const studio = studioMap.get(room.studioId), nodeId = studio?.assignedNodeId || null;
    const existing = [...rooms.values()].find(value => value.studioId === room.studioId && value.name === room.name);
    if (existing) continue;
    const snapshot = snapshots.find(item => item.nodeId === nodeId);
    rooms.set(`registry:${room.roomId}`, { ...room, nodeId, mediaRoom: null, participantCount: snapshot?.ok ? 0 : null,
      participants: [], topologyAvailable: snapshot?.ok === true, nodeLatencyMs: snapshot?.latencyMs ?? null,
      origin: "registry", onAir: false });
  }
  return { studios: [...studioMap.values()], rooms: [...rooms.values()] };
}
