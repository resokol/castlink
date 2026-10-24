import {NextRequest,NextResponse} from 'next/server';
import {sameOrigin} from '@/lib/access';
import {validateStudioId} from '@/lib/studio-scope';
import {remotePcReader,remotePcPrincipal} from '@/lib/remote-pc-access';
import {remotePcStore} from '@/lib/remote-pc-source-server';
import {REMOTE_PC_PURPOSE} from '@/lib/remote-pc-protocol';
import {consumeRateLimit,rateLimitHeaders} from '@/lib/rate-limit';
export const runtime='nodejs',dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
const fields:Record<string,string[]>={begin:['mode'],read:[],controller:['sessionId','generation'],delegate:['sessionId','generation','revision','controllerIdentity','controllerSid'],'request-control':['sessionId','generation','revision'],'decide-request':['sessionId','generation','revision','requestId','decision'],'finish-control':['sessionId','generation','revision','grantId'],revoke:['sessionId','generation','revision'],stop:['sessionId','generation','revision'],pair:['ticket'],'native-source':['captureId','sourceKind','name','geometry','audio','inputStatus'],'native-published':['captureId','helperSid','videoTrackSid','audioTrackSid'],'native-geometry':['captureId','geometry','inputStatus'],'native-lease':['requestId','requestSeq'],'native-activated':['grantId','revision','activationNonce','leaseSerial'],'native-revoked':['revision','leaseSerial'],'native-stop':['captureId']};
async function bounded(request:NextRequest){if(Number(request.headers.get('content-length'))>8192)throw Object.assign(new Error(),{status:413});const reader=request.body?.getReader();if(!reader)return JSON.parse(await request.text());let size=0;const chunks:Uint8Array[]=[];try{while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192)throw Object.assign(new Error(),{status:413});chunks.push(value);}}finally{await reader.cancel().catch(()=>undefined);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
export async function POST(request:NextRequest){
 try{
  const url=new URL(request.url),loopback=process.env.CASTLINK_HELPER_ALLOW_LOOPBACK_TEST==='1'&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname);
  if(!sameOrigin(request)||request.headers.get('origin')&&new URL(request.headers.get('origin')!).protocol!==url.protocol||url.protocol!=='https:'&&!loopback)return reply({error:'REMOTE_PC_ORIGIN'},403);
  const limit=consumeRateLimit(request,{scope:'remote-pc-control',limit:1200,windowMs:60000});if(!limit.ok)return NextResponse.json({error:'REMOTE_PC_RATE'},{status:429,headers:rateLimitHeaders(limit)});
  let data;try{data=await bounded(request);}catch(error){return reply({error:'REMOTE_PC_REQUEST'},(error as {status?:number}).status===413?413:400);}if(!data||typeof data!=='object'||Array.isArray(data)||data.purpose!==REMOTE_PC_PURPOSE||typeof data.action!=='string'||!fields[data.action])return reply({error:'REMOTE_PC_REQUEST'},400);
  const native=data.action.startsWith('native-'),base=['purpose','action',...(native?['nativeId','sessionId','generation']:data.action==='pair'?[]:['studioId','room'])];
  if(Object.keys(data).some(key=>![...base,...fields[data.action]].includes(key)))return reply({error:'REMOTE_PC_REQUEST'},400);
  if(data.action==='pair')return reply(await remotePcStore.pair(data.ticket));
  if(native){const token=request.headers.get('authorization')?.match(/^Bearer (rn1_\S+)$/i)?.[1]||'';return reply(await remotePcStore.native(token,data));}
  if(!request.headers.get('origin'))return reply({error:'REMOTE_PC_ORIGIN'},403);
  let studioId:string;try{studioId=validateStudioId(data.studioId);}catch{return reply({error:'REMOTE_PC_STUDIO'},400);}const room=data.room;if(typeof room!=='string'||!room||room.length>100)return reply({error:'REMOTE_PC_ROOM'},400);const scope={studioId,room};
  if(data.action==='read'){const reader=await remotePcReader(request,scope);if(!reader)return reply({error:'REMOTE_PC_AUTH'},401);const result=await remotePcStore.read(scope,reader.principal);if(reader.target){result.sources=result.sources.filter(source=>source.owner.identity===reader.target);result.sessions=result.sessions.filter(session=>session.owner.identity===reader.target);}return reply(result);}
  const owner=await remotePcPrincipal(request,scope);if(!owner)return reply({error:'REMOTE_PC_AUTH'},401);
  return reply(await remotePcStore.browser(scope,owner,data));
 }catch(error){const status=(error as {status?:number}).status;return reply({error:typeof (error as {code?:unknown}).code==='string'&&(error as {code:string}).code.startsWith('REMOTE_PC_')?(error as {code:string}).code:'REMOTE_PC_UNAVAILABLE'},status&&[400,401,403,409,413,503].includes(status)?status:503);}
}
