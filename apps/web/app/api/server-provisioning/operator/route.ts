import {timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {putServerPeer} from '../../../../lib/server-profiles';
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
  await putServerPeer(data.peer);return json({ok:true});
 }catch{return json({error:'Operator registration refused'},400);}
}
