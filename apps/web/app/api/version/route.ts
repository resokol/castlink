import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store" };
  try {
    const version = process.env.NODE_ENV === "development" ? process.env.NEXT_PUBLIC_APP_VERSION :
      (await readFile(path.join(process.cwd(), process.env.NEXT_BUILD_DIR || ".next", "BUILD_ID"), "utf8")).trim();
    if (!version) throw Error("Version unavailable");
    return NextResponse.json({ version }, { headers });
  } catch {
    return NextResponse.json({ error: "Не удалось определить версию сервера" }, { status: 503, headers });
  }
}
