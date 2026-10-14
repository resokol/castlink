import {NextRequest,NextResponse} from 'next/server';
import {sameOrigin} from '../../../lib/access';
import {readRooms} from '../../../lib/room-store';
import {verifiedRoomStudioSession} from '../../../lib/room-studio-access';
import {defaultStudioId,validateStudioId} from '../../../lib/studio-scope';
import {consumeRateLimit,rateLimitHeaders} from '../../../lib/rate-limit';
import {listRoomServerProfiles,validateProvisioningHost,type ServerPeer} from '../../../lib/server-profiles';
import {clearSshCredentials} from '../../../../../scripts/server-provisioning-ssh.mjs';
import {probeSshFingerprint,generateSshKeyPair} from '../../../lib/server-provisioning-ssh';
import {startServerProvisioning,startServerUpdate,getServerProvisioningJob,authorizeSshPublicKey,type ProvisioningInput} from '../../../lib/server-provisioning';
import {withServerPeerRemoval} from '../../../lib/server-provisioning';
import {removeUnusedRoomServerPeer,connectionInUse} from '../../../lib/server-profile-removal';

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
function updateTarget(peer:ServerPeer,roomId:string){
 if(peer.scope.kind!=='room'||peer.scope.roomId!==roomId)return undefined;
 try{return {host:validateProvisioningHost(peer.connectAddress||new URL(peer.origin).hostname),port:22,installationId:peer.installationId};}catch{return undefined;}
}
function profileBinding(peer:ServerPeer){return JSON.stringify([peer.id,peer.installationId,peer.origin,peer.connectAddress,peer.secret,peer.ca,peer.scope]);}
export async function GET(request:NextRequest){
 let auth;try{auth=await authorization(request,request.nextUrl.searchParams.get('room'),request.nextUrl.searchParams.get('studioId')||defaultStudioId());}catch{return json({error:'Доступ создателя комнаты не подтверждён'},401);}
 const jobId=request.nextUrl.searchParams.get('jobId');
 if(jobId){const job=getServerProvisioningJob(jobId,auth.roomId);return job?json(job):json({error:'Подключение не найдено'},404);}
 try{
  const profiles=await listRoomServerProfiles(auth.roomId);
  return json({profiles:profiles.map(peer=>({id:peer.id,label:peer.label,origin:peer.origin,installationId:peer.installationId,scope:peer.scope.kind,...(updateTarget(peer,auth.roomId)?{update:updateTarget(peer,auth.roomId)}:{})}))});
 }catch{return json({error:'Подключения сервера недоступны. Обнови CastLink и проверь конфигурацию установки.'},503);}
}
async function readInput(request:NextRequest){
 const reader=request.body?.getReader();if(!reader)throw Error('Invalid request');let bytes=0;const chunks:Uint8Array[]=[];
 while(true){const value=await reader.read();if(value.done)break;bytes+=value.value.length;if(bytes>163840){await reader.cancel();throw Error('Invalid request');}chunks.push(value.value);}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function DELETE(request:NextRequest){
 if(!sameOrigin(request))return json({error:'Недопустимый источник запроса'},403);
 let data;try{data=await readInput(request);if(!data||typeof data!=='object'||Array.isArray(data)||typeof data.peerId!=='string'||data.confirm!==true)throw Error('Invalid request');}catch{return json({error:'Подтверди удаление подключения сервера'},400);}
 let auth;try{auth=await authorization(request,data.room,data.studioId||defaultStudioId());}catch{return json({error:'Доступ создателя комнаты не подтверждён'},401);}
 try{
  const peer=(await listRoomServerProfiles(auth.roomId)).find(value=>value.id===data.peerId&&value.scope.kind==='room'&&value.scope.roomId===auth.roomId);
  if(!peer)return json({error:'Подключение этой комнаты не найдено. Общие серверы изменяет владелец установки.'},404);
  await withServerPeerRemoval(auth.roomId,peer.installationId,()=>removeUnusedRoomServerPeer(peer,auth.roomId,auth.assertAuthorized));
  return json({removed:true});
 }catch(error){
  if(error instanceof Error&&(error.message===connectionInUse||error.message==='Обновление или подключение сервера уже выполняется'))return json({error:error.message},409);
  return json({error:'Не удалось удалить подключение. Обнови список серверов и повтори попытку.'},409);
 }
}
export async function POST(request:NextRequest){
 if(!sameOrigin(request))return json({error:'Недопустимый источник запроса'},403);
 let data;try{data=await readInput(request);if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid request');}catch{return json({error:'Некорректный запрос'},400);}
 let auth;try{auth=await authorization(request,data.room,data.studioId||defaultStudioId());}catch{clearSshCredentials(data);data.generatedPrivateKey='';return json({error:'Доступ создателя комнаты не подтверждён'},401);}
 const limit=consumeRateLimit(request,{scope:'server-provisioning',limit:5,windowMs:60000});
 if(!limit.ok){clearSshCredentials(data);data.generatedPrivateKey='';return NextResponse.json({error:'Слишком много попыток подключения. Подожди минуту.'},{status:429,headers:rateLimitHeaders(limit)});}
 try{
  if(data.action==='generate-key'){await auth.assertAuthorized();return json(await generateSshKeyPair());}
  const host=validateProvisioningHost(data.host),port=data.port===undefined?22:data.port;
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Некорректный SSH порт');
  if(data.action==='fingerprint')return json({fingerprint:await probeSshFingerprint({host,port})});
  const credentials=data.authType==='private-key'?{authType:'private-key' as const,privateKey:data.privateKey,passphrase:data.passphrase}:{authType:data.authType,password:data.password};
  if(data.action==='authorize-key')return json(await authorizeSshPublicKey({host,port,fingerprint:data.fingerprint,...credentials},data.publicKey,data.generatedPrivateKey,auth.assertAuthorized));
  if(data.action==='update'){
   const peer=(await listRoomServerProfiles(auth.roomId)).find(value=>value.id===data.peerId);
   const target=peer&&updateTarget(peer,auth.roomId);
   if(!peer||!target||host!==target.host||(data.installationId!==undefined&&data.installationId!==target.installationId))throw Error('Некорректный сервер для обновления');
   const binding=profileBinding(peer);
   const assertAuthorized=async()=>{await auth.assertAuthorized();const current=(await listRoomServerProfiles(auth.roomId)).find(value=>value.id===peer.id);if(!current||!updateTarget(current,auth.roomId)||profileBinding(current)!==binding)throw Error('Server update authorization changed');};
   await assertAuthorized();
   return json(startServerUpdate({host:target.host,port,...credentials,fingerprint:data.fingerprint},{roomId:auth.roomId,peer,assertAuthorized}),202);
  }
  if(data.action!=='start')return json({error:'Некорректное действие'},400);
  const input:ProvisioningInput={host,port,...credentials,fingerprint:data.fingerprint,mode:data.mode,label:data.label,...(data.installationId?{installationId:data.installationId}:{})};
  const job=startServerProvisioning(input,auth);
  return json(job,202);
 }catch(error){
  if(error instanceof Error && (error as Error&{code?:string}).code==='ssh-key-installed-unverified')return json({error:'Публичный ключ добавлен, но новый SSH вход не подтверждён. Сохрани скачанный ключ; прежний доступ сохранён.'},400);
  // Only our validation messages are exposed. Transport errors are already
  // finite; raw exception text never contains submitted secrets.
  return json({error:error instanceof Error&&/^(SSH requires|SSH server|SSH connection|Invalid operator|Некоррект|Подключение сервера|Сервер занят)/.test(error.message)?error.message:data.action==='update'?'Не удалось обновить сервер. Проверь SSH и доступ к выбранному VPS.':'Не удалось проверить подключение. Проверь публичный IPv4, SSH порт и доступность VPS.'},400);
 }finally{clearSshCredentials(data);data.generatedPrivateKey='';}
}
