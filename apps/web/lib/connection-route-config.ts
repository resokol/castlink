import type { GuestConnectionRoutes } from "./connection-route";

/** Deployment capability only; it does not claim an allocation or media probe passed. */
export function guestConnectionRoutes(env: NodeJS.ProcessEnv = process.env): GuestConnectionRoutes {
  const transport = env.CASTLINK_TURN_TRANSPORT;
  if (env.CASTLINK_GUEST_RELAY_ENABLED !== "1" || (transport !== "udp" && transport !== "tls443")) {
    return { relay: { configured: false } };
  }
  return { relay: { configured: true, transport } };
}
