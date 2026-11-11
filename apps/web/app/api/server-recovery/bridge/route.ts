import {NextRequest,NextResponse} from 'next/server';
import {consumeRateLimit,rateLimitHeaders} from '../../../../lib/rate-limit';
import {prepareRecovery,completeRecovery,readRecoveryInput} from '../../../../lib/server-recovery';
import type {RecoveryCandidate} from '../../../../../../scripts/server-recovery-store.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:NextRequest){
 if(request.headers.has('origin'))return json({error:'Recovery requires a trusted server operator'},403);
 const limit=consumeRateLimit(request,{scope:'server-recovery-bridge',limit:30,windowMs:60000});
 if(!limit.ok)return NextResponse.json({error:'Recovery request limit exceeded'},{status:429,headers:{'Cache-Control':'no-store',...rateLimitHeaders(limit)}});
 let data;try{data=await readRecoveryInput(request);if(!['prepare','commit'].includes(data.action as string))throw Error();}catch{return json({error:'Invalid recovery request'},400);}
 try{
  const input=data as unknown as RecoveryCandidate;
  return json(data.action==='prepare'?await prepareRecovery(input):await completeRecovery(input));
 }catch{return json({error:'Recovery could not complete. Check the code, server address and HTTPS, or finish the active reserve/transfer and retry the same code before it expires.'},409);}
}
