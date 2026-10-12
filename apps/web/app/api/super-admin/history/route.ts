import { NextRequest,NextResponse } from "next/server";
import { isSuperAdmin } from "../../../../lib/super-admin-access";
import { listControlNodes } from "../../../../lib/control-plane-store";
import { ownNodeId, signedNodeFetch } from "../../../../lib/node-request";
import { localNodeHistory } from "../../../../lib/node-history";
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
    for(const key of ["room","minutes","role","participant","session","resolution","diagnostics","limit","cursor","to"]) {const value=request.nextUrl.searchParams.get(key);if(value!==null) params.set(key,value);}
    if(node.nodeId===ownNodeId()) return NextResponse.json(await localNodeHistory(params),{headers});
    if(!node.endpoint) throw new Error("node_endpoint_missing");
    const data=await signedNodeFetch(node.endpoint,node.nodeId,`/v1/node/history?${params}`);
    if(data.nodeId!==node.nodeId || (params.get("diagnostics")==="audio" ? !Array.isArray(data.history?.samples) :
      !Array.isArray(data.history?.connections) || !Array.isArray(data.history?.series))) throw new Error("invalid_history");
    return NextResponse.json(data.history,{headers});
  } catch {return NextResponse.json({error:"История этой ноды временно недоступна"},{status:503,headers});}
}
