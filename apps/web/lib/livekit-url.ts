/** Caddy routes /rtc and /rtc/* to LiveKit on the website origin. */
export function getLiveKitUrl(): string {
  if (window.location.port === "3000" && process.env.NEXT_PUBLIC_LIVEKIT_URL) {
    return process.env.NEXT_PUBLIC_LIVEKIT_URL;
  }
  const url = new URL(window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.origin;
}
