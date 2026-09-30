import { NextRequest, NextResponse } from "next/server";
import { activateInstallation } from "../../../lib/license-activation";
import { completeSetup, readSetupState, setupRequired, validSetupToken } from "../../../lib/setup-state";
import { sameOrigin } from "../../../lib/access";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  const state = await readSetupState();
  return NextResponse.json({ needsSetup: !state.completedAt }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Недопустимый источник запроса" }, { status: 403, headers: noStore });
  if (!(await setupRequired())) return NextResponse.json({ error: "Первичная настройка уже завершена" }, { status: 409, headers: noStore });

  const setupToken = request.headers.get("x-castlink-setup-token") || "";
  if (!validSetupToken(setupToken)) return NextResponse.json({ error: "Недействительный setup token" }, { status: 401, headers: noStore });

  const raw = await request.text();
  if (raw.length > 4096) return new NextResponse(null, { status: 413, headers: noStore });
  let data: any;
  try { data = JSON.parse(raw); } catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400, headers: noStore }); }

  const mode = data?.mode;
  const serverName = typeof data?.serverName === "string" ? data.serverName.trim() : "";
  const activationCode = typeof data?.activationCode === "string" ? data.activationCode.trim() : "";
  if ((mode !== "public" && mode !== "edge") || !serverName || serverName.length > 120 || !activationCode || activationCode.length > 512) {
    return NextResponse.json({ error: "Некорректные параметры настройки" }, { status: 400, headers: noStore });
  }

  try {
    const activation = await activateInstallation({ activationCode, serverName, mode });
    await completeSetup({ serverName, mode });
    return NextResponse.json({ ok: true, activation }, { headers: noStore });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось активировать сервер" }, { status: 400, headers: noStore });
  }
}
