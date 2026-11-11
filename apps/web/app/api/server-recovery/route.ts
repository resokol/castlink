import {NextRequest,NextResponse} from 'next/server';
import {sameOrigin} from '../../../lib/access';
import {isSuperAdmin} from '../../../lib/super-admin-access';
import {readRooms} from '../../../lib/room-store';
import {verifiedRoomStudioSession} from '../../../lib/room-studio-access';
import {defaultStudioId,validateStudioId} from '../../../lib/studio-scope';
import {getIncomingServerPeer} from '../../../lib/server-profiles';
import {consumeRateLimit,rateLimitHeaders} from '../../../lib/rate-limit';
import {issueServerRecovery,revokeServerRecovery,recoveryRoomVersion,listRecoveryProfiles,readRecoveryInput,type RecoveryAuthority} from '../../../lib/server-recovery';

export const runtime='nodejs';export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:NextRequest){
 try{
  if(!await isSuperAdmin(request))return json({error:'Недостаточно прав владельца сервера'},403);
  const profiles=(await listRecoveryProfiles()).filter(peer=>peer.scope.kind==='installation').map(peer=>({id:peer.id,label:peer.label,origin:peer.origin,installationId:peer.installationId,scope:peer.scope.kind}));
  return json({profiles});
 }catch{return json({error:'Не удалось прочитать подключения сервера'},503);}
}
export async function POST(request:NextRequest){
 if(!request.headers.get('origin')||!sameOrigin(request))return json({error:'Недопустимый источник запроса'},403);
 let data;try{data=await readRecoveryInput(request);if(!['issue','revoke'].includes(data.action as string)||typeof data.peerId!=='string')throw Error();}catch{return json({error:'Некорректный запрос восстановления'},400);}
 const limit=consumeRateLimit(request,{scope:'server-recovery-management',limit:20,windowMs:60000});
 if(!limit.ok)return NextResponse.json({error:'Слишком много попыток. Подожди минуту.'},{status:429,headers:{'Cache-Control':'no-store',...rateLimitHeaders(limit)}});
 try{
  const peer=await getIncomingServerPeer(data.peerId);if(!peer)return json({error:'Подключение сервера не найдено'},404);
  let authority:RecoveryAuthority,assertAuthorized:()=>Promise<void>;
  if(typeof data.room==='string'){
   const studioId=validateStudioId(typeof data.studioId==='string'?data.studioId:defaultStudioId()),room=(await readRooms(studioId)).find(value=>value.name===data.room);
   if(!room?.creatorAccessId||!verifiedRoomStudioSession(request,room,studioId))return json({error:'Доступ создателя комнаты не подтверждён'},401);
   if(peer.scope.kind!=='room'||peer.scope.roomId!==room.creatorAccessId)return json({error:'Восстановить это подключение может только его владелец'},403);
   const roomAuthority={kind:'room' as const,studioId,roomId:room.creatorAccessId,version:recoveryRoomVersion(room,studioId)};authority=roomAuthority;
   assertAuthorized=async()=>{const current=(await readRooms(studioId)).find(value=>value.creatorAccessId===room.creatorAccessId);if(!current||!verifiedRoomStudioSession(request,current,studioId)||recoveryRoomVersion(current,studioId)!==roomAuthority.version)throw Error('Recovery creator authorization changed');};
  }else{
   if(!await isSuperAdmin(request))return json({error:'Недостаточно прав владельца сервера'},403);
   authority={kind:'installation' as const};
   assertAuthorized=async()=>{if(!await isSuperAdmin(request))throw Error('Recovery installation authorization changed');};
  }
  const input={peerId:peer.id,authority,assertAuthorized};
  return json(data.action==='issue'?await issueServerRecovery(input):await revokeServerRecovery(input));
 }catch{return json({error:'Не удалось создать или отозвать код. Обнови список подключений и повтори попытку.'},409);}
}
