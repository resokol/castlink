import { NextRequest, NextResponse } from "next/server";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { TokenVerifier } from "livekit-server-sdk";
import { readRooms } from "@/lib/room-store";
import { setAccessCookie } from "@/lib/access";
import { defaultStudioId, mediaRoomName, validateStudioId } from "../../../lib/studio-scope";

const dir = "/tmp/studiolink-moves";
const safe = (v:string) => Buffer.from(v).toString("base64url");

export async function GET(request: NextRequest) {
  const room=request.nextUrl.searchParams.get("room")||"";
  let studioId: string;
  try { studioId = validateStudioId(request.nextUrl.searchParams.get("studioId") || defaultStudioId()); }
  catch { return new NextResponse(null, { status: 400 }); }
  const identity=request.nextUrl.searchParams.get("identity")||"";
  if(!room||!identity) return NextResponse.json({});
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
    const claims = await new TokenVerifier(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!).verify(token);
    let metadata: any = {};
    try { metadata = JSON.parse(claims.metadata || "{}"); } catch {}
    if (claims.sub !== identity || claims.video?.room !== mediaRoomName(studioId, room) ||
        (metadata.studioId !== studioId && !(studioId === defaultStudioId() && metadata.studioId === undefined))) return new NextResponse(null, { status: 403 });
  } catch { return new NextResponse(null, { status: 401 }); }
  const file=path.join(dir,safe(studioId+"|"+room+"|"+identity));
  try {
    const raw=await readFile(file,"utf8");
    await unlink(file).catch(()=>{});
    const data=JSON.parse(raw);
    if(Date.now()-Number(data.createdAt)>30000) return NextResponse.json({});
    const target = (await readRooms(studioId)).find(r => r.name === data.targetRoom);
    if (!target) return NextResponse.json({});
    const response = NextResponse.json({targetRoom:data.targetRoom});
    if (target.passwordHash) setAccessCookie(response, request, "guest", target.name, target.passwordHash, studioId);
    return response;
  } catch { return NextResponse.json({}); }
}
