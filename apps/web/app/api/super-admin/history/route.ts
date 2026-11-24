import { NextRequest,NextResponse } from "next/server";
import { isSuperAdmin } from "../../../../lib/super-admin-access";
import { listControlNodes } from "../../../../lib/control-plane-store";
import { ownNodeId, remoteRoomDiagnostics, signedNodeFetch } from "../../../../lib/node-request";
import { localNodeHistory, localRoomDiagnostics } from "../../../../lib/node-history";
import { explicitDiagnosticsRange } from "../../../../lib/room-diagnostics-export";
import { consumeRateLimit,rateLimitHeaders } from "../../../../lib/rate-limit";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest) {
  const headers={"Cache-Control":"no-store"};
  try {
    if(!(await isSuperAdmin(request))) return new NextResponse(null,{status:403,headers});
    const limit=consumeRateLimit(request,{scope:"platform-history",limit:90,windowMs:60000});
    if(!limit.ok) return new NextResponse(null,{status:429,headers:{...headers,...rateLimitHeaders(limit)}});
    const nodeId=request.nextUrl.searchParams.get("nodeId"),nodes=await listControlNodes(),node=nodes.find(n=>n.nodeId===nodeId);
    if(!node) return new NextResponse(null,{status:404,headers});
    const params=new URLSearchParams();
    for(const key of ["room","minutes","role","participant","session","resolution","diagnostics","limit","cursor","to","minute"]) {const value=request.nextUrl.searchParams.get(key);if(value!==null) params.set(key,value);}
    if (params.get("diagnostics") === "full" || params.get("diagnostics") === "analysis") {
      // Check before copying the start into the signed query, while duplicate bounds and filters are still visible.
      try {
        const range = explicitDiagnosticsRange(request.nextUrl.searchParams);
        if (range) params.set("from", String(range.from));
      } catch {
        return NextResponse.json({ error: "invalid_history_query" }, { status: 400, headers });
      }
      if (node.nodeId === ownNodeId()) return await localRoomDiagnostics(params, request.signal, node.nodeId);
      if (!node.endpoint) throw new Error("node_endpoint_missing");
      return await remoteRoomDiagnostics(node.endpoint, node.nodeId, params, request.signal);
    }
    if(node.nodeId===ownNodeId()) return NextResponse.json(await localNodeHistory(params),{headers});
    if(!node.endpoint) throw new Error("node_endpoint_missing");
    const data=await signedNodeFetch(node.endpoint,node.nodeId,`/v1/node/history?${params}`);
    const diagnostics=params.get("diagnostics");
    if(data.nodeId!==node.nodeId || (diagnostics==="audio" || diagnostics==="runtime" || diagnostics==="video" ? !Array.isArray(data.history?.samples) :
      !Array.isArray(data.history?.connections) || !Array.isArray(data.history?.series))) throw new Error("invalid_history");
    return NextResponse.json(data.history,{headers});
  } catch {return NextResponse.json({error:"История этой ноды временно недоступна"},{status:503,headers});}
}
