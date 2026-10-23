import type { CoPresentation } from './co-presentation-state';
export type NativePresentation = { id: string; name: string; pages: number; page: number; clickIndex?: number; clickCount?: number; showPosition?: number; ended?: boolean };
export type NativeWindowPresentation = { id: string; name: string; kind: 'window' };
export type NativeControlledPresentation = NativePresentation | NativeWindowPresentation;
export type NativePresentationStatus = NativeControlledPresentation;
export type PreparedWindowPresentation = { preparedId: string; name: string; kind: 'window' };
export type PreparedPresentation = PreparedPptx | PreparedWindowPresentation;
export function isNativeWindowPresentation(value: unknown): value is NativeWindowPresentation {
  return !!value && typeof value === 'object' && (value as {kind?: unknown}).kind === 'window';
}
export function validNativeControlledPresentation(value: NativeControlledPresentation) {
  if (!isNativeWindowPresentation(value)) return validNativePresentation(value);
  return typeof value.id === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(value.id) && typeof value.name === 'string' && !!value.name && value.name.length <= 200 && !/[:/\\\u0000-\u001f\u007f]/.test(value.name) && Object.keys(value).every(key => ['id','name','kind'].includes(key));
}
export type PreparedPptx = { preparedId: string; name: string };
export type PowerPointBridge = {
  version?: number;
  prepare?(value?: {kind: 'window'}): Promise<PreparedPresentation | null>;
  start?(value: { preparedId: string }): Promise<NativeControlledPresentation>;
  step?(value: { id: string; commandId: string; direction: 'next' | 'previous'; expiresAt: number }): Promise<{ commandId: string; status: NativeControlledPresentation }>;
  connect(): Promise<NativeControlledPresentation>;
  connectShared?(value: { captureId: string }): Promise<NativeControlledPresentation>;
  status(id: string): Promise<NativeControlledPresentation>;
  goTo(value: { id: string; page: number }): Promise<NativePresentation>;
  disconnect(id: string): Promise<void>;
};
/** Only the presenter client can bind controls to its own confirmed capture. */
export function sharedPowerPointBridge(host: unknown) {
  const bridge = powerPointBridge(host);
  return bridge?.version === 4 && typeof bridge.connectShared === 'function' && typeof bridge.step === 'function' ? bridge as PowerPointBridge & { connectShared(value: { captureId: string }): Promise<NativeControlledPresentation> } : undefined;
}
export function nativeCaptureId(track: unknown) {
  const value = (track as { mediaStreamTrack?: { castlinkCaptureId?: unknown } })?.mediaStreamTrack?.castlinkCaptureId;
  return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value) ? value : undefined;
}
export type NativeConnectionStage = 'bridge' | 'capture' | 'helper' | 'native' | 'native-response' | 'server-create';
const nativeConnectionCodes = new Set(['POWERPOINT_COM_UNAVAILABLE','POWERPOINT_NO_SLIDESHOW','POWERPOINT_AMBIGUOUS','POWERPOINT_SOURCE_MISMATCH','POWERPOINT_CAPTURE_STALE','POWERPOINT_TIMEOUT','POWERPOINT_NATIVE_UNAVAILABLE','POWERPOINT_UNAVAILABLE','POWERPOINT_DECLINED','POWERPOINT_STALE','POWERPOINT_CLOSED','POWERPOINT_BUSY','POWERPOINT_PAGE','POWERPOINT_FILE','POWERPOINT_COMMAND','POWERPOINT_STEP_UNAVAILABLE']);
export const nativePresentationErrorCode = (value: unknown) => typeof value === 'string' && nativeConnectionCodes.has(value) ? value : undefined;
/** Render only finite diagnostics; native messages may contain document paths. */
export function nativeConnectionFailure(locale: 'ru' | 'en' | 'zh-CN', stage: NativeConnectionStage, cause?: unknown) {
  const code = (cause as {code?: unknown})?.code, status = (cause as {status?: unknown})?.status;
  const safe = nativePresentationErrorCode(code) || (
    stage === 'server-create' && typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599 ? `HTTP_${status}`
    : stage === 'native-response' ? 'INVALID_RESPONSE' : 'POWERPOINT_UNAVAILABLE');
  const generic = {
    ru: 'Не удалось подключить управление PowerPoint. Демонстрация продолжается.',
    en: 'Could not attach PowerPoint controls. Screen sharing continues.',
    'zh-CN': '无法连接 PowerPoint 控制。屏幕共享继续。',
  }[locale];
  const guidance: Record<string, Record<'ru' | 'en' | 'zh-CN', string>> = {
    bridge: {ru:'Обновите клиент ведущего для автоматического управления PowerPoint. Кастерам клиент не нужен.',en:'Update the presenter client for automatic PowerPoint controls. Casters do not need the client.','zh-CN':'请更新演示者客户端以自动控制 PowerPoint。参与者无需客户端。'},
    POWERPOINT_SOURCE_MISMATCH: {ru:'Выберите окно показа PowerPoint. Выбранный источник не совпадает с показом.',en:'Select the PowerPoint slideshow window. The captured source does not match the show.','zh-CN':'请选择 PowerPoint 放映窗口。所选来源与放映不匹配。'},
    POWERPOINT_AMBIGUOUS: {ru:'Оставьте один запущенный показ PowerPoint или выберите его точное окно в клиенте CastLink.',en:'Leave one running slideshow, or use the CastLink client to select its exact window.','zh-CN':'请只保留一个正在放映的 PowerPoint，或使用 CastLink 客户端选择其准确窗口。'},
    POWERPOINT_NO_SLIDESHOW: {ru:'Запустите показ PowerPoint и повторите попытку.',en:'Start the PowerPoint slideshow, then retry.','zh-CN':'请启动 PowerPoint 放映，然后重试。'},
    POWERPOINT_COM_UNAVAILABLE: {ru:'Не удалось получить доступ к PowerPoint.',en:'Could not access PowerPoint.','zh-CN':'无法访问 PowerPoint。'},
    POWERPOINT_TIMEOUT: {ru:'PowerPoint не ответил вовремя.',en:'PowerPoint did not respond in time.','zh-CN':'PowerPoint 未及时响应。'},
    POWERPOINT_DECLINED: {ru:'Ведущий отклонил управление PowerPoint.',en:'The presenter declined PowerPoint controls.','zh-CN':'演示者拒绝了 PowerPoint 控制。'},
    POWERPOINT_CAPTURE_STALE: {ru:'Источник демонстрации изменился. Повторите попытку для текущего показа.',en:'The shared source changed. Retry for the current capture.','zh-CN':'共享来源已更改。请为当前共享重试。'},
  };
  const hint = guidance[stage === 'bridge' ? 'bridge' : safe]?.[locale];
  const sharing = {ru:'Демонстрация продолжается.',en:'Screen sharing continues.','zh-CN':'屏幕共享继续。'}[locale];
  const message = hint ? `${hint} ${sharing}` : generic;
  return `${message} (${stage}:${safe})`;
}
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
  bridge: PowerPointBridge; native: NativeControlledPresentation; current: () => boolean;
  request: (body: Record<string, unknown>) => Promise<{ session?: CoPresentation | null }>;
  changed: (session: CoPresentation) => void; failed: () => void; unavailable?: () => void;
}) {
  let stopped = false, flight = false;
  const completed = new Map<string, { ok: boolean; error?: 'WINDOW_SLIDES_FOREGROUND' }>();
  const current = () => !stopped && options.current();
  return {
    stop() { if (stopped) return; stopped = true; void options.bridge.disconnect(options.native.id).catch(() => undefined); },
    async tick(session: CoPresentation) {
      if (!current() || flight) return;
      flight = true;
      try {
        let actual = await options.bridge.status(options.native.id);
        if (!current()) return;
        if (session.kind === 'window') {
          if (!isNativeWindowPresentation(options.native) || !isNativeWindowPresentation(actual) || !validNativeControlledPresentation(actual) || actual.id !== options.native.id) throw new Error('Presentation window changed');
          const command = session.command;
          if (!command) return;
          if (command.generation !== session.generation || command.controlRevision !== session.controlRevision || command.expiresAt <= Date.now()) return;
          let result = completed.get(command.id);
          if (!result) {
            if (!options.bridge.step) throw new Error('Window steps unavailable');
            result = {ok: false}; completed.set(command.id, result);
            if (completed.size > 128) completed.delete(completed.keys().next().value!);
            try {
              const value = await options.bridge.step({id: options.native.id, commandId: command.id, direction: command.direction, expiresAt: command.expiresAt});
              if (!current()) return;
              if (value.commandId !== command.id || !isNativeWindowPresentation(value.status) || !validNativeControlledPresentation(value.status) || value.status.id !== options.native.id) throw new Error('Window step not confirmed');
              result.ok = true;
            } catch (cause) { if (!current()) return; if ((cause as {code?: string})?.code === 'WINDOW_SLIDES_FOREGROUND') result.error = 'WINDOW_SLIDES_FOREGROUND'; }
          }
          try {
            const response = await options.request({action: 'step-ack', id: session.id, generation: session.generation, commandId: command.id, revision: session.revision, ok: result.ok, ...(result.error ? {error: result.error} : {})});
            if (current() && response.session) options.changed(response.session);
          } catch (cause) {
            const status = (cause as {status?: number})?.status;
            if (status === 401 || status === 403) throw cause;
            if (status !== 409 && current()) (options.unavailable || options.failed)();
          }
          return;
        }
        if (isNativeWindowPresentation(options.native) || isNativeWindowPresentation(actual)) throw new Error('Presentation kind changed');
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
                if (value.commandId !== command.id || isNativeWindowPresentation(value.status) || !validNativePresentation(value.status) || value.status.id !== options.native.id || value.status.pages !== session.pages) throw new Error('Step not confirmed');
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
