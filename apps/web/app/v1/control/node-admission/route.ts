import { NextRequest, NextResponse } from "next/server";
import { reconcileNodeState } from "../../../../lib/node-state-transition";
import { verifiedNodeRequest } from "../../../../lib/node-request";
import { readNodeAdmission, blockNodeParticipant, acknowledgeNodeOperation } from "../../../../lib/node-admission-store";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
export async function GET(request: NextRequest) {
  const nodeId=verifiedNodeRequest(request,undefined,false);
  if (!nodeId) return new NextResponse(null,{status:401,headers});
  const room=request.nextUrl.searchParams.get("room") || "",identity=request.nextUrl.searchParams.get("identity") || "";
  if (room.length>512 || identity.length>256) return new NextResponse(null,{status:400,headers});
  try {return NextResponse.json(await readNodeAdmission(nodeId,room,identity),{headers});}
  catch {return NextResponse.json({error:"admission_unavailable"},{status:503,headers});}
}
export async function POST(request: NextRequest) {
  const raw=await request.text(); if(raw.length>4096) return new NextResponse(null,{status:413,headers});
  const nodeId=verifiedNodeRequest(request,raw,false);
  if(!nodeId) return new NextResponse(null,{status:401,headers});
  try {
    const data=JSON.parse(raw);
    if(data.action==="reconcile") return NextResponse.json(await reconcileNodeState(nodeId),{headers});
    if(data.action==="ack" && Number.isSafeInteger(data.revision) && data.revision>=0) await acknowledgeNodeOperation(nodeId,data.revision);
    else if(data.action==="block" && typeof data.room==="string" && data.room.length>0 && data.room.length<=512 && typeof data.identity==="string" && data.identity.length>0 && data.identity.length<=256) await blockNodeParticipant(nodeId,data.room,data.identity);
    else return new NextResponse(null,{status:400,headers});
    return NextResponse.json({ok:true,nodeId},{headers});
  } catch {return NextResponse.json({error:"node_operation_failed"},{status:503,headers});}
}
