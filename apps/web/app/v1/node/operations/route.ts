import { NextRequest, NextResponse } from "next/server";
import { verifiedNodeRequest } from "../../../../lib/node-request";
import { executeLocalNodeOperation, validNodeOperation } from "../../../../lib/node-operations";
export const dynamic="force-dynamic";
export async function POST(request: NextRequest) {
  const headers={"Cache-Control":"no-store"},raw=await request.text();
  if(raw.length>4096) return new NextResponse(null,{status:413,headers});
  if(!verifiedNodeRequest(request,raw)) return new NextResponse(null,{status:401,headers});
  let command:unknown; try {command=JSON.parse(raw);} catch {return new NextResponse(null,{status:400,headers});}
  if(!validNodeOperation(command)) return new NextResponse(null,{status:400,headers});
  try {return NextResponse.json(await executeLocalNodeOperation(command),{headers});}
  catch(error) {return NextResponse.json({error:error instanceof Error ? error.message : "node_operation_failed"},{status:409,headers});}
}
