import { NextRequest, NextResponse } from "next/server";
import { maintenanceResponse } from "./lib/update-maintenance";

export function proxy(request: NextRequest) {
  return maintenanceResponse(request.method, request.nextUrl.pathname) || NextResponse.next();
}

// These routes enforce maintenance before reading their request streams. Keep
// large uploads and crash reports out of proxy body cloning.
export const config = {
  matcher: ["/api", "/api/((?!(?:presentation-file|client-errors)/?$).*)"],
};
