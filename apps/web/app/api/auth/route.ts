import { NextRequest, NextResponse } from "next/server";
import { canJoin, checkPassword, clearGuestAccess, isStudio, sameOrigin, setAccessCookie, validGuestInvite } from "@/lib/access";
import { readRooms } from "@/lib/room-store";
export const runtime = "nodejs";
const attempts = new Map<string, { count: number; until: number }>();
export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("kind") === "studio") return NextResponse.json({ allowed: isStudio(request) }, { headers: { "Cache-Control": "no-store" } });
  const name = request.nextUrl.searchParams.get("room") || "demo-room";
  const room = (await readRooms()).find(r => r.name === name);
  return NextResponse.json({ exists: !!room, allowed: !!room && canJoin(request, name, room.passwordHash) }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  const raw = await request.text();
  if (raw.length > 4096) return new NextResponse(null, { status: 413 });
  let data; try { data = JSON.parse(raw); } catch { return new NextResponse(null, { status: 400 }); }
  if (!data || typeof data !== "object" || Array.isArray(data)) return new NextResponse(null, { status: 400 });
  const { kind, room: rawName = "", password = "", invite = "" } = data;
  if (!["studio", "guest"].includes(kind) || typeof rawName !== "string" || rawName.length > 100 || typeof password !== "string" || password.length > 256 || typeof invite !== "string" || invite.length > 4096) return new NextResponse(null, { status: 400 });
  const name = rawName.trim();
  if (kind === "guest" && !name) return NextResponse.json({ error: "Введите название комнаты" }, { status: 400 });
  const denied = (error: string, status: number) => {
    const response = NextResponse.json({ error }, { status });
    if (kind === "guest") clearGuestAccess(response, name);
    return response;
  };
  const key = `${request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "local"}:${kind}:${String(name).slice(0, 100)}`;
  const now = Date.now();
  for (const [id, attempt] of attempts) if (attempt.until < now) attempts.delete(id);
  if ((attempts.get(key)?.count || 0) >= 10) return denied("Слишком много попыток. Повторите через 5 минут.", 429);
  const room = kind === "guest" ? (await readRooms()).find(r => r.name === name) : undefined;
  const hash = kind === "studio" ? process.env.STUDIOLINK_STUDIO_PASSWORD_HASH : room?.passwordHash;
  if (kind === "guest" && !room) return denied("Комната не найдена", 404);
  const allowed = kind === "guest" && invite ? validGuestInvite(invite, name, hash) :
    kind === "guest" && !hash ? password === "" : !!hash && checkPassword(password, hash);
  if (!allowed) {
    if (attempts.size > 10000) attempts.clear();
    attempts.set(key, { count: (attempts.get(key)?.count || 0) + 1, until: attempts.get(key)?.until || now + 300000 });
    return denied(invite ? "Приглашение недействительно или срок его действия истёк" : kind === "guest" && !hash ? "В этой комнате пароль не установлен. Оставьте поле пароля пустым." : "Неверный пароль", 401);
  }
  attempts.delete(key);
  const response = NextResponse.json({ allowed: true });
  setAccessCookie(response, request, kind, name, hash);
  return response;
}
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  const response = NextResponse.json({ ok: true }); response.cookies.delete("studiolink-studio"); return response;
}
