import { NextRequest,NextResponse } from 'next/server';
import { maintenanceResponse } from './lib/update-maintenance';
export function middleware(request:NextRequest){return maintenanceResponse(request.method,request.nextUrl.pathname)||NextResponse.next();}
// Next 15 Node middleware does not await body-clone finalization. Streaming
// multipart uploads can therefore lose their first chunk before the API runs.
// This endpoint enforces maintenance itself, before authentication/body access.
export const config={matcher:['/api','/api/((?!presentation-file/?$).*)'],runtime:'nodejs'};
