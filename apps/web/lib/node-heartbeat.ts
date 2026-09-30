import { createHmac, timingSafeEqual } from "node:crypto";

export type NodeHeartbeat = {
  schemaVersion: 1;
  nodeId: string;
  sentAt: number;
  region: string;
  nodeType: "cloud" | "self-hosted" | "edge";
  activeStudios: number;
  activeParticipants: number;
  activeVideoTracks: number;
  cpuLoad?: number;
  memoryLoad?: number;
  networkOutMbps?: number;
};

export function canonicalHeartbeatBody(payload: NodeHeartbeat) {
  return JSON.stringify(payload);
}

export function signHeartbeat(body: string, secret: string) {
  return createHmac("sha256", secret).update("castlink-node-heartbeat-v1:").update(body).digest("base64url");
}

export function verifyHeartbeatSignature(body: string, signature: string, secret: string) {
  if (!signature || signature.length > 256 || !secret) return false;
  const expected = Buffer.from(signHeartbeat(body, secret));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function validateHeartbeat(value: unknown, now = Date.now()): NodeHeartbeat {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid heartbeat");
  const p = value as Record<string, unknown>;
  if (p.schemaVersion !== 1) throw new Error("Unsupported heartbeat schema");
  if (typeof p.nodeId !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(p.nodeId)) throw new Error("Invalid nodeId");
  if (typeof p.sentAt !== "number" || !Number.isFinite(p.sentAt) || Math.abs(now - p.sentAt) > 60_000) throw new Error("Stale heartbeat");
  if (typeof p.region !== "string" || !p.region.trim() || p.region.length > 80) throw new Error("Invalid region");
  if (!["cloud", "self-hosted", "edge"].includes(String(p.nodeType))) throw new Error("Invalid nodeType");

  for (const field of ["activeStudios", "activeParticipants", "activeVideoTracks"] as const) {
    if (!Number.isSafeInteger(p[field]) || Number(p[field]) < 0) throw new Error(`Invalid ${field}`);
  }
  for (const field of ["cpuLoad", "memoryLoad"] as const) {
    if (p[field] !== undefined && (typeof p[field] !== "number" || !Number.isFinite(p[field]) || Number(p[field]) < 0 || Number(p[field]) > 1)) {
      throw new Error(`Invalid ${field}`);
    }
  }
  if (p.networkOutMbps !== undefined && (typeof p.networkOutMbps !== "number" || !Number.isFinite(p.networkOutMbps) || Number(p.networkOutMbps) < 0)) {
    throw new Error("Invalid networkOutMbps");
  }

  return p as unknown as NodeHeartbeat;
}
