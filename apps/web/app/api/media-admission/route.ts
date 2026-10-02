import { NextRequest, NextResponse } from "next/server";
import { TokenVerifier } from "livekit-server-sdk";
import { admissionConfigured, localNodeAdmission } from "../../../lib/node-admission";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
/** Caddy forward_auth runs only before a signalling handshake, never on RTP/UDP. */
export async function GET(request: NextRequest) {
  if(!admissionConfigured()) return new NextResponse(null,{status:503,headers});
  const original=request.headers.get("x-forwarded-uri") || "";
  if(original.length>18000) return new NextResponse(null,{status:413,headers});
  let room:string,identity:string;
  try {
    const url=new URL(original,"https://node.invalid");
    const headerToken=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
    const queryTokens=url.searchParams.getAll("access_token");
    if(queryTokens.length>1 || headerToken && queryTokens[0] && headerToken!==queryTokens[0]) return new NextResponse(null,{status:403,headers});
    const token=queryTokens[0] || headerToken;
    const key=process.env.LIVEKIT_API_KEY,secret=process.env.LIVEKIT_API_SECRET;
    if(!token || token.length>16000 || !key || !secret) return new NextResponse(null,{status:401,headers});
    const claims=await new TokenVerifier(key,secret).verify(token);
    if(!claims.video?.roomJoin || !claims.video.room || !claims.sub) return new NextResponse(null,{status:403,headers});
    room=claims.video.room; identity=claims.sub;
  } catch {return new NextResponse(null,{status:401,headers});}
  try {
    const decision=await localNodeAdmission(room,identity);
    return new NextResponse(null,{status:decision.allowed ? 204 : 403,headers});
  } catch {return new NextResponse(null,{status:503,headers});}
}
