import { ConnectionError, ConnectionErrorReason, type Room, type RoomConnectOptions } from "livekit-client";

export type GuestConnectionRoute = "auto" | "normal" | "relay";
export type GuestRelayConfiguration = { configured: boolean; transport?: "udp" | "tls443" };
export type GuestConnectionRoutes = { relay: GuestRelayConfiguration };

export class GuestRelayUnavailableError extends Error {
  readonly name = "GuestRelayUnavailableError";
  constructor(cause?: unknown) {
    super("Запасной маршрут TURN на этом сервере не настроен. Попробуйте другую сеть или VPN.", { cause });
  }
}

function canRetryViaRelay(error: unknown): boolean {
  if (!(error instanceof ConnectionError)) return false;
  // LiveKit reports initial ICE failures as InternalError, and a PC deadline as
  // Timeout. Signalling/auth failures cannot be repaired by changing ICE policy.
  return (error.reason === ConnectionErrorReason.Timeout && !/signal|websocket/i.test(error.message)) ||
    (error.reason === ConnectionErrorReason.InternalError && /could not establish (?:PC|publisher|subscriber) connection/i.test(error.message));
}

/** A bounded initial guest join. The SDK owns reconnection after a successful join. */
export async function connectGuestRoom(
  room: Pick<Room, "connect" | "disconnect">,
  url: string,
  token: string,
  settings: {
    route?: GuestConnectionRoute;
    relay?: GuestRelayConfiguration;
    options?: RoomConnectOptions;
    onAttempt?: (route: "normal" | "relay") => void;
    isActive?: () => boolean;
  } = {},
): Promise<"normal" | "relay"> {
  const route = settings.route || "auto";
  const options = { autoSubscribe: false, ...settings.options };
  const active = () => settings.isActive?.() !== false;
  const attempt = async (selected: "normal" | "relay") => {
    if (!active()) throw ConnectionError.cancelled("Guest connection cancelled");
    settings.onAttempt?.(selected);
    await room.connect(url, token, selected === "relay"
      ? { ...options, rtcConfig: { ...options.rtcConfig, iceTransportPolicy: "relay" } }
      : options);
    return selected;
  };
  if (route === "relay") {
    if (!settings.relay?.configured) throw new GuestRelayUnavailableError();
    return attempt("relay");
  }
  try { return await attempt("normal"); }
  catch (error) {
    if (route !== "auto" || !active() || !canRetryViaRelay(error)) throw error;
    if (!settings.relay?.configured) throw new GuestRelayUnavailableError(error);
    await room.disconnect();
    return attempt("relay");
  }
}
