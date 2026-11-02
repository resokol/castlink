import { sessionHttpBearer } from "./session-http-bearer";
import { acceptPresentationCommand, type PresentationDirection, type PresentationResult, type PresentationStatus } from './presentation-control';

export async function presentationRequest<T = Record<string, unknown>>(token: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const response = await fetch('/api/presentation-control', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${sessionHttpBearer(token)}` }, body: JSON.stringify(body), signal: signal || AbortSignal.timeout(5000), cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Не удалось изменить управление презентацией.');
  return data as T;
}

/** Each local connection starts fresh. Network loss stops navigation until explicit reconnect. */
export function createPdfPresentationBridge(options: {
  token: string; connectionId: string;
  getStatus: () => PresentationStatus;
  navigate: (direction: PresentationDirection) => void | Promise<void>;
  onStopped: (error: string) => void;
  request?: typeof presentationRequest;
}) {
  const request = options.request || presentationRequest;
  let lastSeq = 0, stopped = false, inFlight = false;
  let result: PresentationResult | undefined;
  const abort = new AbortController();
  return {
    stop() { stopped = true; abort.abort(); },
    async poll() {
      if (stopped || inFlight) return;
      inFlight = true;
      try {
        const timeout = AbortSignal.timeout(5000);
        const response = await request<{ command?: unknown }>(options.token, { action: 'poll', connectionId: options.connectionId, status: options.getStatus(), ...(result ? { result } : {}) }, AbortSignal.any([abort.signal, timeout]));
        if (stopped) return;
        result = undefined;
        const command = acceptPresentationCommand(response.command, options.connectionId, lastSeq);
        if (!command) return;
        // Record before applying: even a failed local render cannot replay navigation.
        lastSeq = command.seq;
        try { await options.navigate(command.direction); result = { seq: command.seq, ok: true }; }
        catch (cause) { result = { seq: command.seq, ok: false, error: cause instanceof Error ? cause.message.slice(0, 240) : 'Не удалось сменить страницу PDF.' }; }
      } catch (cause) {
        if (!stopped) { stopped = true; options.onStopped(cause instanceof Error ? cause.message : 'Управление презентацией отключено. Подключите его заново.'); }
      } finally { inFlight = false; }
    },
  };
}

export function presentationPage(page: number, direction: PresentationDirection, pages: number) {
  return Math.max(1, Math.min(pages, page + (direction === 'next' ? 1 : -1)));
}
