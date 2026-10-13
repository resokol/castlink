import { readAudioHistory, readHistory } from "./telemetry-store";
import type { TelemetryRole } from "./telemetry-types";
export async function localNodeHistory(params: URLSearchParams) {
  const room=params.get("room") || "", minutes=Number(params.get("minutes") || 15);
  const role=params.get("role") || "",participant=params.get("participant") || "",session=params.get("session") || "";
  if(!room || room.length>512 || ![15,60,360,720,1440].includes(minutes) || participant.length>256 || session.length>128 ||
    role && !["guest","admin","moderator","studio","output","monitor"].includes(role)) throw new Error("invalid_history_query");
  if(params.get("diagnostics")==="audio") return readAudioHistory(room,minutes,{session:session || undefined,identity:participant || undefined,
    role:role as TelemetryRole || undefined,limit:Number(params.get("limit") || 1000),cursor:params.get("cursor") || undefined,
    to:params.has("to") ? Number(params.get("to")) : undefined});
  return readHistory(room,minutes,session || undefined,params.get("resolution")==="2s",participant || undefined,role as TelemetryRole || undefined,
    params.has("to") ? Number(params.get("to")) : undefined);
}
