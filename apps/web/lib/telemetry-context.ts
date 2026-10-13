/** Client-side routing hints only. The server always verifies JWT/signature and scope. */
export function telemetryContext(token: string, fallbackRoom: string) {
  let claims: any = {};
  try {
    if (token.length > 32_768) throw new Error("oversized token");
    const payload = token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");
    const binary = atob(payload.padEnd(Math.ceil(payload.length/4)*4,"="));
    claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary,char=>char.charCodeAt(0))));
    if (!claims || typeof claims !== "object") claims = {};
  } catch { claims = {}; }
  let metadata: any = {};
  try { metadata = JSON.parse(claims.metadata || "{}"); } catch { /* Optional routing metadata. */ }
  if (!metadata || typeof metadata !== "object") metadata = {};
  const studioId = typeof metadata.studioId === "string" && /^[A-Za-z0-9._:-]{6,128}$/.test(metadata.studioId)
    ? metadata.studioId : "studio-default";
  const roomName = typeof metadata.roomDisplayName === "string" && metadata.roomDisplayName.length <= 100
    ? metadata.roomDisplayName : fallbackRoom;
  const mediaRoom = typeof claims.video?.room === "string" ? claims.video.room : fallbackRoom;
  const tokenRole = ["studio-panel","studio-moderator","guest","output","monitor"].includes(metadata.role)
    ? metadata.role as string : undefined;
  const expiresAt = typeof claims.exp === "number" && Number.isFinite(claims.exp) ? claims.exp * 1000 : null;
  return { studioId, roomName, mediaRoom, tokenRole, expiresAt, moderatorPanel: metadata.panelMode === "moderator" };
}
