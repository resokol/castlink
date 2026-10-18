import {NextRequest,NextResponse} from "next/server";
import {readRooms} from "@/lib/room-store";
import {setRoomStudioCookie} from "@/lib/room-studio-access";
export async function POST(request:NextRequest){
 if(process.env.CASTLINK_SLOTS_QA!=="1"||!['localhost','127.0.0.1'].includes(request.nextUrl.hostname))return new NextResponse(null,{status:404});
 const {role}=await request.json(),response=NextResponse.json({ok:true});
 if(role==='studio'){const room=(await readRooms('studio-default')).find(r=>r.name==='QA A');if(!room?.creatorAccessId||!room.studioPasswordHash)return NextResponse.json({error:'QA room creator is not configured'},{status:400});setRoomStudioCookie(response,request,room,'studio-default');}
 return response;
}
