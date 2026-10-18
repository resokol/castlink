type ReplyTrack = { stop(): void; mute(): Promise<unknown>; unmute(): Promise<unknown> };
export type PrivateReplyDependencies<T extends ReplyTrack> = {
  begin(): Promise<{ replyId: string }>;
  end(replyId?: string): Promise<{ restoreMicrophone: boolean }>;
  ready?(current: () => boolean): Promise<unknown>;
  muteMain(): Promise<unknown>;
  restoreMain(): Promise<unknown>;
  capture(): Promise<T>;
  publish(track: T): Promise<unknown>;
  unpublish(track: T): Promise<unknown>;
  current(): boolean;
  canRestore(): boolean;
  warnIfRestoreBlocked?(): boolean;
  busy(active: boolean): void;
  speaking(active: boolean): void;
  failed(): void;
};

/** One physical press owns the gate until its capture has stopped and the server acknowledges release. */
export function createPrivateReplyController<T extends ReplyTrack>(dependencies: PrivateReplyDependencies<T>) {
  let held = false;
  let flight: Promise<void> | undefined;
  let track: T | undefined;
  let releaseHold: (() => void) | undefined;
  const stopCapture = () => { track?.stop(); dependencies.speaking(false); };
  return {
    press() {
      if (flight || !dependencies.current()) return;
      held = true;
      const hold = new Promise<void>(resolve => { releaseHold = resolve; });
      dependencies.busy(true);
      const current = () => held && dependencies.current();
      const work = async () => {
        let replyId: string | undefined;
        let failed = false;
        try {
          const gate = await dependencies.begin();
          replyId = gate.replyId;
          if (!current()) return;
          await dependencies.ready?.(current);
          if (!current()) return;
          await dependencies.muteMain();
          if (!current()) return;
          track = await dependencies.capture();
          if (!current()) return;
          await track.mute();
          if (!current()) return;
          await dependencies.publish(track);
          if (!current()) return;
          await track.unmute();
          if (!current()) return;
          dependencies.speaking(true);
          await hold;
        } catch {
          failed = true;
        } finally {
          stopCapture();
          if (track) await dependencies.unpublish(track).catch(() => undefined);
          track = undefined;
          try {
            const ended = await dependencies.end(replyId);
            if (!failed && ended.restoreMicrophone && dependencies.canRestore()) await dependencies.restoreMain();
            else if (ended.restoreMicrophone && dependencies.warnIfRestoreBlocked?.()) failed = true;
          } catch { failed = true; }
          if (failed) {
            await dependencies.muteMain().catch(() => undefined);
            dependencies.failed();
          }
          held = false;
          releaseHold = undefined;
          dependencies.busy(false);
        }
      };
      flight = work().finally(() => { flight = undefined; });
    },
    release() {
      held = false;
      releaseHold?.();
      stopCapture();
      return flight || Promise.resolve();
    },
  };
}

/** HTTP and LiveKit permission acknowledgements arrive on different transports. */
export function waitForPrivateReplyPermission(allowed: () => boolean, current: () => boolean, timeoutMs = 3000): Promise<boolean> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (!current()) { resolve(false); return; }
      if (allowed()) { resolve(true); return; }
      if (Date.now() - started >= timeoutMs) { reject(new Error("Приватная связь недоступна")); return; }
      setTimeout(check, 25);
    };
    check();
  });
}
