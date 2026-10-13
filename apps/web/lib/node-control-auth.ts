import { createHmac, timingSafeEqual } from "node:crypto";

const prefix = "castlink-node-control-v1:";

export function signNodeControlRequest(secret: string, timestamp: string, method: string, pathAndQuery: string) {
  return createHmac("sha256", secret)
    .update(prefix)
    .update(timestamp)
    .update(":")
    .update(method.toUpperCase())
    .update(":")
    .update(pathAndQuery)
    .digest("base64url");
}

export function verifyNodeControlRequest(
  secret: string,
  timestamp: string,
  method: string,
  pathAndQuery: string,
  signature: string,
  now = Date.now(),
) {
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > 60_000 || !signature || signature.length > 256) return false;
  const expected = Buffer.from(signNodeControlRequest(secret, timestamp, method, pathAndQuery));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
