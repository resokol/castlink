import { NextRequest,NextResponse } from "next/server";
import { verifiedNodeRequest, ownNodeId } from "../../../../lib/node-request";
import { localNodeHistory, localRoomDiagnostics } from "../../../../lib/node-history";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest) {
  const headers={"Cache-Control":"no-store"};
  if(!verifiedNodeRequest(request)) return new NextResponse(null,{status:401,headers});
  try {
    const params = request.nextUrl.searchParams;
    if (params.get("diagnostics") === "full" || params.get("diagnostics") === "analysis") {
      return await localRoomDiagnostics(params, request.signal, ownNodeId());
    }
    return NextResponse.json({nodeId:ownNodeId(),history:await localNodeHistory(request.nextUrl.searchParams)},{headers});}
  catch {return NextResponse.json({error:"history_unavailable"},{status:503,headers});}
}
