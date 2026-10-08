import {NextRequest,NextResponse} from 'next/server';
import {sameOrigin} from '../../../lib/access';
import {readRooms} from '../../../lib/room-store';
import {verifiedRoomStudioSession} from '../../../lib/room-studio-access';
import {defaultStudioId,validateStudioId} from '../../../lib/studio-scope';
import {consumeRateLimit,rateLimitHeaders} from '../../../lib/rate-limit';
import {listRoomServerProfiles,validateProvisioningHost} from '../../../lib/server-profiles';
import {probeSshFingerprint} from '../../../lib/server-provisioning-ssh';
import {startServerProvisioning,getServerProvisioningJob,type ProvisioningInput} from '../../../lib/server-provisioning';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
async function authorization(request:NextRequest,roomName:unknown,rawStudioId:unknown){
 if(typeof roomName!=='string'||!roomName||typeof rawStudioId!=='string')throw Error('auth');
 const studioId=validateStudioId(rawStudioId||defaultStudioId());
 const room=(await readRooms(studioId)).find(value=>value.name===roomName);
 if(!room?.creatorAccessId||!verifiedRoomStudioSession(request,room,studioId))throw Error('auth');
 const roomId=room.creatorAccessId,passwordHash=room.studioPasswordHash;
 return {roomId,assertAuthorized:async()=>{
  const current=(await readRooms(studioId)).find(value=>value.name===roomName);
  if(!current||current.creatorAccessId!==roomId||current.studioPasswordHash!==passwordHash||!verifiedRoomStudioSession(request,current,studioId))throw Error('Room creator authorization changed');
 }};
}
export async function GET(request:NextRequest){
 let auth;try{auth=await authorization(request,request.nextUrl.searchParams.get('room'),request.nextUrl.searchParams.get('studioId')||defaultStudioId());}catch{return json({error:'Доступ создателя комнаты не подтверждён'},401);}
 const jobId=request.nextUrl.searchParams.get('jobId');
 if(jobId){const job=getServerProvisioningJob(jobId,auth.roomId);return job?json(job):json({error:'Подключение не найдено'},404);}
 try{
  const profiles=await listRoomServerProfiles(auth.roomId);
  return json({profiles:profiles.map(peer=>({id:peer.id,label:peer.label,origin:peer.origin,installationId:peer.installationId,scope:peer.scope.kind}))});
 }catch{return json({error:'Подключения сервера недоступны. Обнови CastLink и проверь конфигурацию установки.'},503);}
}
async function readInput(request:NextRequest){
 const reader=request.body?.getReader();if(!reader)throw Error('Invalid request');let bytes=0;const chunks:Uint8Array[]=[];
 while(true){const value=await reader.read();if(value.done)break;bytes+=value.value.length;if(bytes>8192){await reader.cancel();throw Error('Invalid request');}chunks.push(value.value);}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function POST(request:NextRequest){
 if(!sameOrigin(request))return json({error:'Недопустимый источник запроса'},403);
 let data;try{data=await readInput(request);}catch{return json({error:'Некорректный запрос'},400);}
 let auth;try{auth=await authorization(request,data.room,data.studioId||defaultStudioId());}catch{return json({error:'Доступ создателя комнаты не подтверждён'},401);}
 const limit=consumeRateLimit(request,{scope:'server-provisioning',limit:5,windowMs:60000});
 if(!limit.ok)return NextResponse.json({error:'Слишком много попыток подключения. Подожди минуту.'},{status:429,headers:rateLimitHeaders(limit)});
 try{
  const host=validateProvisioningHost(data.host),port=data.port===undefined?22:data.port;
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Некорректный SSH порт');
  if(data.action==='fingerprint')return json({fingerprint:await probeSshFingerprint({host,port})});
  if(data.action!=='start')return json({error:'Некорректное действие'},400);
  const input:ProvisioningInput={host,port,password:data.password,fingerprint:data.fingerprint,mode:data.mode,label:data.label,...(data.installationId?{installationId:data.installationId}:{})};
  const job=startServerProvisioning(input,auth);
  data.password='';return json(job,202);
 }catch(error){
  // Only our validation messages are exposed. Transport errors are already
  // finite; raw exception text never contains submitted secrets.
  return json({error:error instanceof Error&&/^(SSH requires|SSH server|SSH connection|Invalid operator|Некоррект|Подключение сервера|Сервер занят)/.test(error.message)?error.message:'Не удалось проверить подключение. Проверь публичный IPv4, SSH порт и доступность VPS.'},400);
 }
}
