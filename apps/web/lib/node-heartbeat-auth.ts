export function heartbeatSecretForNode(nodeId: string) {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(nodeId)) return null;
  const ownNodeId = process.env.CASTLINK_NODE_ID?.trim() || process.env.STUDIOLINK_TRANSFER_SERVER_ID?.trim() || "";
  const ownSecret = process.env.CASTLINK_NODE_SECRET?.trim() || "";
  if (nodeId === ownNodeId && ownSecret.length >= 32 && ownSecret.length <= 512) return ownSecret;
  const raw = process.env.CASTLINK_NODE_SECRETS_JSON?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const value = (parsed as Record<string, unknown>)[nodeId];
    return typeof value === "string" && value.length >= 32 && value.length <= 512 ? value : null;
  } catch {
    return null;
  }
}
