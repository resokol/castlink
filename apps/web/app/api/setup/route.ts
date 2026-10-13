import { NextRequest, NextResponse } from "next/server";
import { activateInstallation } from "../../../lib/license-activation";
import { deploymentModel } from "../../../lib/deployment-model";
import { completeSetup, readSetupState, setupRequired, validSetupToken, SetupConflictError } from "../../../lib/setup-state";
import { sameOrigin } from "../../../lib/access";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const model = deploymentModel();
    const state = await readSetupState();
    return NextResponse.json({ needsSetup: !state.completedAt, deploymentModel: model }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Не удалось проверить состояние настройки" }, { status: 500, headers: noStore });
  }
}

export async function POST(request: NextRequest) {
  if (!request.headers.get("origin") || !sameOrigin(request)) return NextResponse.json({ error: "Недопустимый источник запроса" }, { status: 403, headers: noStore });
  let legacy = false;
  try {
    if (!(await setupRequired())) return NextResponse.json({ error: "Первичная настройка уже завершена" }, { status: 409, headers: noStore });
    const setupToken = request.headers.get("x-castlink-setup-token") || "";
    if (!validSetupToken(setupToken)) return NextResponse.json({ error: "Недействительный setup token" }, { status: 401, headers: noStore });

    const raw = await request.text();
    if (raw.length > 4096) return new NextResponse(null, { status: 413, headers: noStore });
    let data: any;
    try { data = JSON.parse(raw); } catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400, headers: noStore }); }
    legacy = deploymentModel() === "legacy";
    const mode = data?.mode;
    const serverName = typeof data?.serverName === "string" ? data.serverName.trim() : "";
    const activationCode = typeof data?.activationCode === "string" ? data.activationCode.trim() : "";
    if ((mode !== "public" && mode !== "edge") || !serverName || serverName.length > 120 || (legacy && (!activationCode || activationCode.length > 512))) {
      return NextResponse.json({ error: "Некорректные параметры настройки" }, { status: 400, headers: noStore });
    }
    await completeSetup({ serverName, mode }, legacy ? () => activateInstallation({ activationCode, serverName, mode }) : undefined);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    const conflict = error instanceof SetupConflictError;
    return NextResponse.json({ error: conflict ? "Первичная настройка завершена или заблокирована другой операцией" : "Не удалось завершить настройку сервера" }, { status: conflict ? 409 : legacy ? 400 : 500, headers: noStore });
  }
}
