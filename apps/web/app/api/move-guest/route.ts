import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { isStudio, sameOrigin } from "@/lib/access";

const dir = "/tmp/studiolink-moves";
const safe = (v:string) => Buffer.from(v).toString("base64url");

export async function POST(request: NextRequest) {
  if (!isStudio(request) || !sameOrigin(request)) return new NextResponse(null, { status: 401 });
  const { room, identity, targetRoom } = await request.json();
  if (!room || !identity || !targetRoom || room === targetRoom) return NextResponse.json({error:"invalid request"},{status:400});
  await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir, safe(room+"|"+identity)), JSON.stringify({targetRoom,createdAt:Date.now()}), "utf8");
  return NextResponse.json({ok:true});
}
