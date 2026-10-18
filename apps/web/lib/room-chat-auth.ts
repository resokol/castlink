import { AccessToken, TokenVerifier } from "livekit-server-sdk";

export const roomChatIssuer = (key: string) => `${key}:room-chat`;

/** Only the credential renewal endpoint allows a bounded expired signature.
 * It must additionally verify the current live guest and signed session nonce. */
export async function verifyRoomChatToken(token: string, key: string, secret: string, renewing = false) {
  for (const issuer of [key, roomChatIssuer(key)]) {
    try {
      const claims = await new TokenVerifier(issuer, secret).verify(token, renewing ? 86400 : 0);
      if (renewing && (typeof claims.nbf !== "number" || claims.nbf > Date.now() / 1000 + 5 ||
          typeof claims.iat === "number" && claims.iat > Date.now() / 1000 + 5)) continue;
      const metadata = JSON.parse(claims.metadata || "{}");
      if ((issuer !== key) !== (metadata.roomChatOnly === true)) continue;
      return { claims, metadata };
    } catch { /* Try the other first-party issuer, never an unsigned payload. */ }
  }
  return null;
}

export async function issueRoomChatToken(key: string, secret: string, identity: string, name: string, mediaRoom: string, metadata: Record<string, unknown>) {
  const token = new AccessToken(roomChatIssuer(key), secret, { identity, name, ttl: "24h", metadata: JSON.stringify({
    role: "guest", studioId: metadata.studioId, roomDisplayName: metadata.roomDisplayName,
    roomChatAssociation: metadata.roomChatAssociation, transferSessionId: metadata.transferSessionId, roomChatOnly: true,
  }) });
  token.addGrant({ room: mediaRoom, roomJoin: false, canPublish: false, canSubscribe: false, canPublishData: false });
  return token.toJwt();
}
