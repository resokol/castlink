export function heartbeatSecretForNode(nodeId: string) {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(nodeId)) return null;
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
