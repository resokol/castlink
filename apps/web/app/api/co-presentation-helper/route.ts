import { NextRequest, NextResponse } from 'next/server';
import { sameOrigin } from '@/lib/access';
import { validateStudioId } from '@/lib/studio-scope';
import { consumeRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { livePresentationGuest, presentationGuest } from '@/lib/co-presentation-access';
import { createHelperBroker } from '@/lib/co-presentation-helper';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const broker = createHelperBroker({live:livePresentationGuest});
const reply = (body: unknown, status = 200) => NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
function secure(request: NextRequest) {
  try {
    const url=new URL(request.url);
    return url.protocol==='https:' || process.env.CASTLINK_HELPER_ALLOW_LOOPBACK_TEST==='1' && url.protocol==='http:' && ['127.0.0.1','localhost'].includes(url.hostname);
  } catch { return false; }
}
async function bounded(request: NextRequest, max: number) {
  if (Number(request.headers.get('content-length'))>max) throw Object.assign(new Error(),{status:413});
  if (request.body) {
    const reader=request.body.getReader(), chunks:Uint8Array[]=[];let size=0;
    try { while(true) { const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max)throw Object.assign(new Error(),{status:413});chunks.push(value); } }
    finally { await reader.cancel().catch(()=>undefined); }
    return Buffer.concat(chunks).toString('utf8');
  }
  const raw=await request.text();
  if(Buffer.byteLength(raw,'utf8')>max)throw Object.assign(new Error(),{status:413});
  return raw;
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request) || !secure(request)) return reply({error:'Invalid request origin'},403);
  const origin=request.headers.get('origin');
  // sameOrigin validates the public Host, including its port. Next standalone
  // reconstructs request.url with its internal listen address behind a proxy.
  if(origin) { try { if(new URL(origin).protocol!==new URL(request.url).protocol)return reply({error:'Invalid request origin'},403); } catch { return reply({error:'Invalid request origin'},403); } }
  const bearer=request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1] || '';
  const helper=bearer.startsWith('ch2_');
  const limit=consumeRateLimit(request,{scope:'co-presentation-helper',limit:900,windowMs:60000});
  if (!limit.ok) return NextResponse.json({error:'Too many requests'},{status:429,headers:rateLimitHeaders(limit)});
  try {
    let data:Record<string,unknown>;
    try { data=JSON.parse(await bounded(request,helper?32768:4096)); }
    catch(error) { return reply({error:'Invalid request'},(error as {status?:number}).status || 400); }
    if(!data || typeof data!=='object' || Array.isArray(data))return reply({error:'Invalid request'},400);
    if(helper) {
      if(!['poll','result','disconnect'].includes(data.action as string) || typeof data.connectionId!=='string' || Object.keys(data).some(k=>!['action','connectionId','operationId','result','browserControl'].includes(k)) || data.browserControl !== undefined && (data.action !== 'poll' || data.browserControl !== 1))return reply({error:'Invalid helper action'},400);
      return reply(await broker.native(bearer,data.connectionId,data.action as string,data));
    }
    // The one-use challenge is the sole native bootstrap credential without
    // Origin. It never grants room/JWT privileges.
    if(data.action==='pair' && typeof data.code==='string') {
      if(Object.keys(data).some(k=>!['action','code'].includes(k)))return reply({error:'Invalid request'},400);
      return reply(await broker.pair(data.code));
    }
    if(!request.headers.get('origin'))return reply({error:'Owner origin required'},403);
    if(!['pair','state','request','result','disconnect'].includes(data.action as string) || Object.keys(data).some(k=>!['action','studioId','room','clientRequestId','method','args','operationId','pairingId'].includes(k)))return reply({error:'Invalid owner action'},400);
    let studioId:string;
    try { studioId=validateStudioId(data.studioId as string); } catch { return reply({error:'Invalid studio'},400); }
    if(typeof data.room!=='string' || !data.room || data.room.length>100)return reply({error:'Invalid room'},400);
    const owner=await presentationGuest(request,studioId,data.room);
    if(!owner)return reply({error:'Current caster session required'},401);
    const scope={studioId,room:data.room};
    if(data.action==='pair')return reply(broker.createPair(scope,owner));
    return reply(await broker.owner(scope,owner,data.action as string,data));
  } catch(error) {
    return reply({error:'Presentation helper unavailable'},[400,401,409,413,503].includes((error as {status:number})?.status)?(error as {status:number}).status:503);
  }
}
