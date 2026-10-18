import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient, TokenVerifier } from "livekit-server-sdk";
import { sameOrigin } from "@/lib/access";
import { readRooms } from "@/lib/room-store";
import { defaultStudioId, mediaRoomName, validateStudioId } from "@/lib/studio-scope";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { parsePresentationStatus, type PresentationResult } from "@/lib/presentation-control";
import { connectPresentation, createPresentation, dropPresentation, issuePresentationCommand, pollPresentation, presentationById, presentationByToken, presentationEntries, presentationSnapshot, type PresentationBinding, type PresentationPrincipal } from "@/lib/presentation-control-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: noStore });
const client = () => new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
const samePrincipal = (a: PresentationPrincipal, b: PresentationPrincipal) => a.identity === b.identity && a.sid === b.sid;
async function binding(studioId: string, room: string): Promise<PresentationBinding | undefined> {
  const record = (await readRooms(studioId)).find(r => r.name === room);
  if (!record?.creatorAccessId) return;
  const version = createHash("sha256").update(JSON.stringify([record.creatorAccessId, record.studioPasswordHash, record.passwordHash])).digest("hex");
  return { studioId, room, version };
}
async function participant(studioId: string, room: string, identity: string): Promise<PresentationPrincipal | undefined> {
  if (!/^guest-[A-Za-z0-9_-]{1,180}$/.test(identity)) return;
  try {
    const p = await client().getParticipant(mediaRoomName(studioId, room), identity), metadata = JSON.parse(p.metadata || "{}");
    if (metadata.role !== "guest" || !(metadata.studioId === studioId || studioId === defaultStudioId() && metadata.studioId === undefined) || !p.sid) return;
    return { identity, sid: p.sid };
  } catch { return; }
}
async function browserPrincipal(token: string, studioId: string, room: string) {
  try {
    const claims = await new TokenVerifier(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!).verify(token), metadata = JSON.parse(claims.metadata || "{}");
    if (claims.video?.room !== mediaRoomName(studioId, room) || metadata.role !== "guest" || !(metadata.studioId === studioId || studioId === defaultStudioId() && metadata.studioId === undefined) || !claims.sub) return false;
    return await participant(studioId, room, claims.sub) || false;
  } catch { return; }
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Invalid request origin" }, 403);
  if (Number(request.headers.get("content-length")) > 4096) return reply({ error: "Request too large" }, 413);
  let data: Record<string, unknown>;
  try { const raw = await request.text(); if (raw.length > 4096) return reply({ error: "Request too large" }, 413); data = JSON.parse(raw); if (!data || typeof data !== "object" || Array.isArray(data)) throw Error(); }
  catch { return reply({ error: "Invalid request" }, 400); }
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const action = data.action;
  const limit = consumeRateLimit(request, { scope: action === "pair" ? "presentation-pair" : "presentation-control", limit: action === "pair" ? 10 : 300, windowMs: 60_000, ...(action === "pair" ? {} : { subject: createHash("sha256").update(token).digest("hex").slice(0, 24) }) });
  if (!limit.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { ...noStore, ...rateLimitHeaders(limit) } });
  try {
    if (action === "connect" || action === "poll") {
      const entry = presentationByToken(token, action === "connect");
      if (!entry) return reply({ error: "Pairing expired or revoked" }, 401);
      const owner = await participant(entry.binding.studioId, entry.binding.room, entry.owner.identity);
      const current = await binding(entry.binding.studioId, entry.binding.room);
      if (presentationById(entry.id) !== entry || !owner || !samePrincipal(owner, entry.owner) || !current || current.version !== entry.binding.version) { dropPresentation(entry); return reply({ error: "Presentation owner disconnected or room changed" }, 401); }
      if (typeof data.connectionId !== "string" || !/^[a-f0-9-]{36}$/.test(data.connectionId)) return reply({ error: "Invalid connection" }, 400);
      if (action === "connect") {
        const connected = connectPresentation(entry, data.connectionId);
        return connected ? reply(connected) : reply({ error: "Pairing already used" }, 401);
      }
      if (data.connectionId !== entry.connectionId) return reply({ error: "Connection changed; pair again" }, 409);
      const status = data.status === undefined ? undefined : parsePresentationStatus(data.status);
      if (data.status !== undefined && !status) return reply({ error: "Invalid presentation status" }, 400);
      let result: PresentationResult | undefined;
      if (data.result !== undefined) {
        const r = data.result as PresentationResult;
        if (!r || !Number.isSafeInteger(r.seq) || r.seq < 1 || typeof r.ok !== "boolean" || r.error !== undefined && (typeof r.error !== "string" || r.error.length > 240) || Object.keys(r).some(k => !["seq", "ok", "error"].includes(k))) return reply({ error: "Invalid command result" }, 400);
        result = { seq: r.seq, ok: r.ok, ...(r.error ? { error: r.error } : {}) };
      }
      const response = pollPresentation(entry, status, result);
      return "conflict" in response ? reply({ error: "Command result is stale" }, 409) : reply(response);
    }
    let studioId: string;
    try { studioId = validateStudioId(typeof data.studioId === "string" && data.studioId ? data.studioId : defaultStudioId()); } catch { return reply({ error: "Invalid studio" }, 400); }
    if (typeof data.room !== "string" || !data.room || data.room.length > 200) return reply({ error: "Invalid room" }, 400);
    const room = data.room;
    const principal = await browserPrincipal(token, studioId, room);
    if (!principal) return reply({ error: "Current caster session required" }, principal === false ? 403 : 401);
    // Binding is captured after async media authorization and before mutation.
    const current = await binding(studioId, room);
    if (!current) return reply({ error: "Room not found" }, 404);
    if (action === "read") {
      const sessions = presentationEntries(studioId, room).filter(e => e.binding.version === current.version).map(presentationSnapshot);
      return reply({ sessions });
    }
    if (action === "pair") {
      if (data.kind !== "powerpoint" && data.kind !== "pdf") return reply({ error: "Choose PowerPoint or PDF" }, 400);
      return reply(createPresentation(current, principal, data.kind));
    }
    const entry = typeof data.sessionId === "string" ? presentationById(data.sessionId) : undefined;
    if (!entry || entry.binding.studioId !== studioId || entry.binding.room !== room || entry.binding.version !== current.version) return reply({ error: "Presentation is unavailable" }, 404);
    const isOwner = samePrincipal(principal, entry.owner);
    if (action === "revoke") { if (!isOwner) return reply({ error: "Only the caster who shared it can stop presentation control" }, 403); dropPresentation(entry); return reply({ ok: true }); }
    if (action === "delegate") {
      if (!isOwner) return reply({ error: "Only the presentation owner can delegate control" }, 403);
      const controller = typeof data.controllerIdentity === "string" ? await participant(studioId, room, data.controllerIdentity) : undefined;
      const latest = await binding(studioId, room);
      if (!controller || !latest || latest.version !== entry.binding.version || presentationById(entry.id) !== entry) return reply({ error: "Caster is no longer in this room" }, 409);
      entry.controller = controller; entry.pending = undefined; return reply({ ok: true });
    }
    if (action !== "command" || data.direction !== "next" && data.direction !== "previous") return reply({ error: "Only next and previous are supported" }, 400);
    if (!isOwner && !samePrincipal(principal, entry.controller)) return reply({ error: "The owner has not granted you control" }, 403);
    const command = issuePresentationCommand(entry, data.direction);
    return command ? reply({ command }) : reply({ error: "Presentation is offline or the previous command is still pending" }, 409);
  } catch { return reply({ error: "Presentation control is temporarily unavailable" }, 503); }
}
