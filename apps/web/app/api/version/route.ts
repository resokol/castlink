import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store" };
  try {
    const buildId = process.env.NODE_ENV === "development"
      ? process.env.NEXT_PUBLIC_BUILD_ID || process.env.NEXT_PUBLIC_APP_VERSION
      : (await readFile(path.join(process.cwd(), process.env.NEXT_BUILD_DIR || ".next", "BUILD_ID"), "utf8")).trim();
    const productVersion = process.env.NEXT_PUBLIC_PRODUCT_VERSION?.trim();
    if (!buildId || !productVersion) throw Error("Version unavailable");
    return NextResponse.json({
      version: buildId,
      buildId,
      productVersion,
      ...(process.env.NEXT_PUBLIC_BUILD_NUMBER ? { buildNumber: process.env.NEXT_PUBLIC_BUILD_NUMBER } : {}),
    }, { headers });
  } catch {
    return NextResponse.json({ error: "Не удалось определить версию сервера" }, { status: 503, headers });
  }
}
