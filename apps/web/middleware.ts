import { NextRequest,NextResponse } from 'next/server';
import { maintenanceResponse } from './lib/update-maintenance';
export function middleware(request:NextRequest){return maintenanceResponse(request.method,request.nextUrl.pathname)||NextResponse.next();}
export const config={matcher:'/api/:path*',runtime:'nodejs'};
