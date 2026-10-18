import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deliberately do not import the retained optional handler or its state. Old
// browser tabs and native helpers must stop before any presentation operation.
export async function POST() {
  return NextResponse.json({ error: "Presentation control is temporarily disabled", disabled: true }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
