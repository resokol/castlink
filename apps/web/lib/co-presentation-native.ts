import type { CoPresentation } from './co-presentation-state';
export type NativePresentation = { id: string; name: string; pages: number; page: number };
export type PowerPointBridge = {
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
  return !!value && typeof value.id === 'string' && !!value.id && value.id.length <= 200 && typeof value.name === 'string' && !!value.name && value.name.length <= 180 && Number.isSafeInteger(value.pages) && value.pages >= 1 && value.pages <= 10000 && Number.isSafeInteger(value.page) && value.page >= 1 && value.page <= value.pages;
}
/** Executes exact slides only, and never owns PowerPoint's app or its media capture. */
export function createNativePresentationControl(options: {
  bridge: PowerPointBridge; native: NativePresentation; current: () => boolean;
  request: (body: Record<string, unknown>) => Promise<{ session?: CoPresentation | null }>;
  changed: (session: CoPresentation) => void; failed: () => void;
}) {
  let stopped = false, flight = false;
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
        const pending = session.revision !== session.renderedRevision;
        if (pending) {
          if (actual.page !== session.page) actual = await options.bridge.goTo({ id: options.native.id, page: session.page });
          if (!current()) return;
          if (!validNativePresentation(actual) || actual.id !== options.native.id || actual.pages !== session.pages || actual.page !== session.page) throw new Error('Slide not confirmed');
        }
        if (!pending && actual.page === session.page) return;
        const response = await options.request({ action: pending ? 'ack' : 'sync', id: session.id, generation: session.generation, revision: session.revision, page: actual.page });
        if (current() && response.session) options.changed(response.session);
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
