import type { CoPresentation } from './co-presentation-state';
export type NativePresentation = { id: string; name: string; pages: number; page: number; clickIndex?: number; clickCount?: number; showPosition?: number; ended?: boolean };
export type PreparedPptx = { preparedId: string; name: string };
export type PowerPointBridge = {
  version?: number;
  prepare?(): Promise<PreparedPptx | null>;
  start?(value: { preparedId: string }): Promise<NativePresentation>;
  step?(value: { id: string; commandId: string; direction: 'next' | 'previous'; expiresAt: number }): Promise<{ commandId: string; status: NativePresentation }>;
  connect(): Promise<NativePresentation>;
  status(id: string): Promise<NativePresentation>;
  goTo(value: { id: string; page: number }): Promise<NativePresentation>;
  disconnect(id: string): Promise<void>;
};
export function powerPointBridge(host: unknown): PowerPointBridge | undefined {
  try {
    const desktop = (host as { castlinkDesktop?: { version?: number; powerPoint?: PowerPointBridge } })?.castlinkDesktop;
    const bridge = desktop?.powerPoint;
    if (desktop?.version === 1 && bridge && ['connect', 'status', 'goTo', 'disconnect'].every(key => typeof bridge[key as keyof PowerPointBridge] === 'function')) return bridge;
  } catch { /* Plain browsers do not expose a desktop bridge. */ }
}
export function validNativePresentation(value: NativePresentation) {
  return !!value && typeof value.id === 'string' && !!value.id && value.id.length <= 200 && typeof value.name === 'string' && !!value.name && value.name.length <= 200 && Number.isSafeInteger(value.pages) && value.pages >= 1 && value.pages <= 10000 && Number.isSafeInteger(value.page) && value.page >= 1 && value.page <= value.pages;
}
/** Executes exact slides only, and never owns PowerPoint's app or its media capture. */
export function createNativePresentationControl(options: {
  bridge: PowerPointBridge; native: NativePresentation; current: () => boolean;
  request: (body: Record<string, unknown>) => Promise<{ session?: CoPresentation | null }>;
  changed: (session: CoPresentation) => void; failed: () => void; unavailable?: () => void;
}) {
  let stopped = false, flight = false;
  const completed = new Map<string, { ok: boolean }>();
  const current = () => !stopped && options.current();
  return {
    stop() { if (stopped) return; stopped = true; void options.bridge.disconnect(options.native.id).catch(() => undefined); },
    async tick(session: CoPresentation) {
      if (!current() || flight) return;
      flight = true;
      try {
        let actual = await options.bridge.status(options.native.id);
        if (!current()) return;
        if (!validNativePresentation(actual) || actual.id !== options.native.id || actual.pages !== session.pages) throw new Error('Presentation changed');
        if (session.navigationMode === 'powerpoint-steps-v1') {
          try {
          const command = session.command;
          if (command) {
            if (command.generation !== session.generation || command.controlRevision !== session.controlRevision || command.expiresAt <= Date.now()) return;
            let result = completed.get(command.id);
            if (!result) {
              if (!options.bridge.step) throw new Error('PowerPoint steps unavailable');
              // Reserve before the effect. A failed/ambiguous native call is
              // never repeated by a later poll of the same command.
              result = { ok: false }; completed.set(command.id, result);
              if (completed.size > 128) completed.delete(completed.keys().next().value!);
              try {
                const value = await options.bridge.step({ id: options.native.id, commandId: command.id, direction: command.direction, expiresAt: command.expiresAt });
                if (!current()) return;
                if (value.commandId !== command.id || !validNativePresentation(value.status) || value.status.id !== options.native.id || value.status.pages !== session.pages) throw new Error('Step not confirmed');
                actual = value.status;
                result.ok = true;
              } catch { if (!current()) return; }
            }
            const response = await options.request({ action: 'step-ack', id: session.id, generation: session.generation, commandId: command.id, revision: session.revision, page: actual.page, ok: result.ok });
            if (current() && response.session) options.changed(response.session);
          } else if (actual.page !== session.page || session.renderedPage !== actual.page) {
            const response = await options.request({ action: 'sync', id: session.id, generation: session.generation, revision: session.revision, page: actual.page });
            if (current() && response.session) options.changed(response.session);
          }
          } catch (cause) {
            const status = cause && typeof cause === 'object' && 'status' in cause ? cause.status : undefined;
            if (status === 401 || status === 403) throw cause;
            if (status !== 409 && current()) (options.unavailable || options.failed)();
          }
          return;
        }
        const pending = session.revision !== session.renderedRevision;
        if (pending) {
          if (actual.page !== session.page) actual = await options.bridge.goTo({ id: options.native.id, page: session.page });
          if (!current()) return;
          if (!validNativePresentation(actual) || actual.id !== options.native.id || actual.pages !== session.pages || actual.page !== session.page) throw new Error('Slide not confirmed');
        }
        if (!pending && actual.page === session.page) return;
        try {
          const response = await options.request({ action: pending ? 'ack' : 'sync', id: session.id, generation: session.generation, revision: session.revision, page: actual.page });
          if (current() && response.session) options.changed(response.session);
        } catch (cause) {
          const status = cause && typeof cause === 'object' && 'status' in cause ? cause.status : undefined;
          if (status === 409) return;
          if (status === 401 || status === 403) throw cause;
          // A failed server round-trip does not invalidate the local COM grant.
          // Disable remote controls until a fresh read; retain independent STOP.
          if (current()) (options.unavailable || options.failed)();
        }
      } catch (cause) {
        // A remote navigation can win the race against a manual-slide sync.
        // Refresh authoritative state on the next poll instead of undoing it.
        if (cause && typeof cause === 'object' && 'status' in cause && cause.status === 409) return;
        if (current()) options.failed();
      }
      finally { flight = false; }
    },
  };
}
