import {timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {putServerPeer,replaceServerPeer,getIncomingServerPeer} from '../../../../lib/server-profiles';
import {withUnusedServerPeer,connectionInUse} from '../../../../lib/server-profile-removal';
import {issueServerRecovery} from '../../../../lib/server-recovery';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:NextRequest){
 const expected=process.env.CASTLINK_SETUP_TOKEN||'',received=request.headers.get('x-castlink-profile-operator')||'';
 const a=Buffer.from(expected),b=Buffer.from(received);
 if(request.headers.has('origin')||expected.length<32||received.length>1024||a.length!==b.length||!timingSafeEqual(a,b))return json({error:'Operator authorization required'},401);
 try{
  const reader=request.body?.getReader();if(!reader)throw Error('Missing input');let count=0;const chunks:Uint8Array[]=[];
  while(true){const next=await reader.read();if(next.done)break;count+=next.value.length;if(count>65536){await reader.cancel();throw Error('Input too large');}chunks.push(next.value);}
  const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!process.env.STUDIOLINK_INSTALLATION_ID||data.expectedInstallationId!==process.env.STUDIOLINK_INSTALLATION_ID)throw Error('Installation mismatch');
  const assertAuthorized=async()=>{if(process.env.CASTLINK_SETUP_TOKEN!==expected||data.expectedInstallationId!==process.env.STUDIOLINK_INSTALLATION_ID)throw Error('Operator authority changed');};
  if(data.action==='recovery-code')return json({ok:true,...await issueServerRecovery({peerId:data.peerId,authority:{kind:'installation'},assertAuthorized})});
  if(data.action==='replace'){
   const previous=await getIncomingServerPeer(data.peer?.id);
   const replace=()=>replaceServerPeer({peer:data.peer,expectedBinding:data.expectedBinding,assertAuthorized});
   if(previous)await withUnusedServerPeer(previous,replace);else await replace();
   return json({ok:true});
  }
  if(data.action!==undefined&&data.action!=='register')throw Error('Unknown operator action');
  await putServerPeer(data.peer);return json({ok:true});
 }catch(error){if(error instanceof Error&&error.message===connectionInUse)return json({error:'Finish the active reserve or transfer before replacing this connection'},409);return json({error:'Operator registration refused'},400);}
}
