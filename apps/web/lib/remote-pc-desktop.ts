import { RoomEvent, Track, type Room } from 'livekit-client';
import { REMOTE_PC_MOVE_TOPIC, REMOTE_PC_RELIABLE_TOPIC, type RemotePcBeginResponse, type RemotePcControlRequest, type RemotePcResponse, type RemotePcSession } from './remote-pc-protocol';
type Scope = {
    captureId: string;
    sessionId: string;
    generation: string;
};
type Person = {
    identity: string;
    sid: string;
    name: string;
};
type Toolbar = Scope & {
    revision: number;
    sequence: number;
    expiresAt: number;
    locale: 'ru' | 'en' | 'zh-CN';
    status: 'ready' | 'paused';
    busy: boolean;
    participants: Person[];
    requests: {
        id: string;
        requester: Person;
        expiresAt: number;
    }[];
    controller?: Person;
    error?: string;
};
type Intent = Scope & {
    revision: number;
    sequence: number;
} & ({
    action: 'delegate';
    participant: {
        identity: string;
        sid: string;
    };
} | {
    action: 'decide-request';
    requestId: string;
    decision: 'approve' | 'deny';
} | {
    action: 'revoke';
});
export type RemoteControlBridge = {
    version: 1;
    capabilities(): Promise<{
        version: 1;
        supported: boolean;
        resourceVersion: number;
        publicationMode: string;
        fullInputPause: boolean;
    }>;
    attach(value: ScopeAttach): Promise<Scope>;
    geometry(value: {
        captureId: string;
        width: number;
        height: number;
    }): Promise<unknown>;
    receive(value: {
        captureId: string;
        senderSid: string;
        topic: string;
        bytes: Uint8Array;
    }): Promise<unknown>;
    stop(value: Scope & {
        reason: 'finish' | 'capture-ended' | 'source-changed' | 'disconnect' | 'authority-lost' | 'attach-stale' | 'dispose' | 'error';
    }): Promise<unknown>;
    updateToolbar(value: Toolbar): Promise<unknown>;
    onState(listener: (value: Partial<Scope> & {
        captureId: string;
        state: string;
        reason?: string;
    }) => void): () => void;
    onIntent(listener: (value: Intent) => void): () => void;
};
type ScopeAttach = {
    ticket: string;
    captureId: string;
    ownerSid: string;
    videoTrackSid: string;
    audioTrackSid?: string;
    width: number;
    height: number;
};
export function remoteControlBridge(host: unknown): RemoteControlBridge | undefined {
    try {
        const bridge = (host as {
            castlinkDesktop?: {
                remoteControl?: RemoteControlBridge;
            };
        })?.castlinkDesktop?.remoteControl;
        if (bridge?.version === 1 && ['capabilities', 'attach', 'geometry', 'receive', 'stop', 'updateToolbar', 'onState', 'onIntent'].every(k => typeof (bridge as unknown as Record<string, unknown>)[k] === 'function'))
            return bridge;
    }
    catch { }
}
type DesktopStatus = {
    supported: boolean;
    restart: boolean;
};
const statuses = new WeakMap<Room, {
    value: DesktopStatus;
    listeners: Set<() => void>;
}>();
const defaultStatus: DesktopStatus = { supported: false, restart: false };
function statusStore(room: Room) { let s = statuses.get(room); if (!s) {
    s = { value: defaultStatus, listeners: new Set() };
    statuses.set(room, s);
} return s; }
export function remotePcDesktopStatus(room: Room) { return statusStore(room).value; }
export function subscribeRemotePcDesktop(room: Room, listener: () => void) { const s = statusStore(room); s.listeners.add(listener); return () => { s.listeners.delete(listener); }; }
function setStatus(room: Room, next: DesktopStatus) { const s = statusStore(room); if (s.value.supported !== next.supported || s.value.restart !== next.restart) {
    s.value = next;
    s.listeners.forEach(f => f());
} }
const clean = (value: string, max: number) => value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);
export const remotePcDesktopUnavailable = 'Restart screen sharing to restore PC control.';
/** Uses the already published, preload-tagged SDK capture. Never creates tracks or a Room. */
export function createRemotePcDesktopOwner({ room, host, read, request, serverTime = Date.now }: {
    room: Room;
    serverTime?: () => number;
    host: unknown;
    read: () => {
        ready: boolean;
        updatedAt?: number;
        sessions: readonly RemotePcSession[];
        requests: readonly RemotePcControlRequest[];
    };
    request: (body: Record<string, unknown>) => Promise<RemotePcResponse>;
}) {
    const bridge = remoteControlBridge(host);
    if (!bridge)
        return { sync() { }, dispose() { } };
    let disposed = false, supported = false, probing = true, serial = 0, inFlight = false, busy = false, sequence = 0, error: string | undefined;
    type Capture = {
        captureId: string;
        media: MediaStreamTrack;
        track: unknown;
        sid: string;
        ownerSid: string;
        audioSid?: string;
    };
    let observed: MediaStreamTrack | undefined, probeCapture: MediaStreamTrack | undefined;
    let capture: Capture | undefined, binding: Scope | undefined, attempt: Capture | undefined, terminal: MediaStreamTrack | undefined, lastToolbar: Toolbar | undefined;
    const current = (): Capture | undefined => { const p = room.localParticipant.getTrackPublication?.(Track.Source.ScreenShare), media = p?.track?.mediaStreamTrack, captureId = (media as MediaStreamTrack & {
        castlinkCaptureId?: string;
    })?.castlinkCaptureId; if (room.state !== 'connected' || !p?.track || p.isMuted || media?.readyState !== 'live' || !captureId || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(captureId))
        return; return { captureId, media, track: p.track, sid: p.trackSid, ownerSid: room.localParticipant.sid, audioSid: room.localParticipant.getTrackPublication?.(Track.Source.ScreenShareAudio)?.trackSid }; };
    const same = (a: Capture | undefined, b: Capture | undefined) => !!a && !!b && a.captureId === b.captureId && a.media === b.media && a.track === b.track && a.sid === b.sid && a.ownerSid === b.ownerSid && a.audioSid === b.audioSid;
    const exact = (a: Scope, b: Scope) => a.captureId === b.captureId && a.sessionId === b.sessionId && a.generation === b.generation;
    const safeStop = (value: Scope, reason: Parameters<RemoteControlBridge['stop']>[0]['reason']) => void bridge?.stop({ ...value, reason }).catch(() => { });
    const cancel = async (session: RemotePcSession) => { try {
        await request({ action: 'stop', sessionId: session.id, generation: session.generation, revision: session.revision });
    }
    catch { } };
    const dimensions = (c: Capture) => { const { width, height } = c.media.getSettings(); return width && height && width <= 32768 && height <= 32768 ? { width, height } : undefined; };
    const eligible = () => [...room.remoteParticipants.values()].filter(p => { try {
        const metadata = JSON.parse(p.metadata || '{}'), role = metadata.role;
        if (metadata.roomChatOnly)
            return false;
        return ['guest', 'studio-panel', 'studio-moderator', 'admin', 'moderator', 'primary'].includes(role) || !role && /^(guest-|studio-panel-|studio-moderator-)/.test(p.identity);
    }
    catch {
        return false;
    } }).filter(p => !/^(remote-pc-|output|monitor|watch|talkback-|stream-viewer-)/.test(p.identity) && [p.identity, p.sid].every(id => typeof id === 'string' && id.length > 0 && id.length <= 256 && !/[\u0000-\u001f\u007f]/.test(id))).slice(0, 250).map(p => ({ identity: clean(p.identity, 256), sid: clean(p.sid, 256), name: clean(p.name || p.identity, 180) }));
    const session = () => { const v = read(); return v.ready && (v.updatedAt === undefined || Date.now() - v.updatedAt <= 1100) && binding && same(capture, current()) ? v.sessions.find(s => s.id === binding!.sessionId && s.generation === binding!.generation && s.owner.identity === room.localParticipant.identity && s.owner.sid === room.localParticipant.sid && s.mode === 'client-owned' && s.phase === 'sharing') : undefined; };
    function toolbar() { const s = session(); if (!bridge || !binding || !s)
        return; const now = Date.now(), serverNow = serverTime(), participants = eligible(), v = read(), lookup = (identity: string, sid: string) => participants.find(p => p.identity === identity && p.sid === sid); const snapshot: Toolbar = { ...binding, revision: s.revision, sequence: ++sequence, expiresAt: now + 1500, locale: typeof document !== 'undefined' && ['en', 'zh-CN'].includes(document.documentElement.lang) ? document.documentElement.lang as 'en' | 'zh-CN' : 'ru', status: s.source?.inputStatus?.state === 'ready' && s.source.inputStatus.pointerReady === true ? 'ready' : 'paused', busy, participants, requests: v.requests.filter(r => r.sessionId === s.id && r.generation === s.generation && r.expiresAt > serverNow && lookup(r.requester.identity, r.requester.sid)).slice(0, 16).map(r => ({ id: r.id, requester: lookup(r.requester.identity, r.requester.sid)!, expiresAt: now + Math.min(r.expiresAt - serverNow, 30000) })), controller: s.grant ? lookup(s.grant.controller.identity, s.grant.controller.sid) : undefined, error }; lastToolbar = snapshot; void bridge.updateToolbar(snapshot).catch(() => { }); }
    async function attach(c: Capture) { inFlight = true; attempt = c; const version = ++serial; let begun: RemotePcBeginResponse | undefined; try {
        begun = await request({ action: 'begin', mode: 'client-owned' }) as RemotePcBeginResponse;
        if (disposed || version !== serial || !same(c, current())) {
            await cancel(begun.session);
            return;
        }
        const size = dimensions(c);
        if (!size) {
            await cancel(begun.session);
            return;
        }
        const result = await bridge!.attach({ ticket: begun.ticket, captureId: c.captureId, ownerSid: c.ownerSid, videoTrackSid: c.sid, ...(c.audioSid ? { audioTrackSid: c.audioSid } : {}), ...size });
        if (disposed || version !== serial || !same(c, current())) {
            safeStop(result, 'attach-stale');
            return;
        }
        if (result.captureId !== c.captureId || result.sessionId !== begun.session.id || result.generation !== begun.session.generation) {
            safeStop(result, 'attach-stale');
            throw new Error('Remote PC scope changed');
        }
        binding = result;
        capture = c;
        setStatus(room, { supported, restart: false });
        toolbar();
    }
    catch {
        if (begun)
            await cancel(begun.session);
        if (!disposed && version === serial && same(c, current())) {
            terminal = c.media;
            error = remotePcDesktopUnavailable;
            setStatus(room, { supported, restart: true });
        }
    }
    finally {
        inFlight = false;
        if (!disposed)
            sync();
    } }
    function sync() { if (disposed || !bridge || probing)
        return; const next = current(); if (!supported) { if(next?.media && next.media!==probeCapture)probe(); return; } if (observed !== next?.media) {
        observed?.removeEventListener('ended', sync);
        observed = next?.media;
        observed?.addEventListener('ended', sync);
    } if (capture && !same(capture, next)) {
        if (binding)
            safeStop(binding, room.state === 'connected' ? 'source-changed' : 'disconnect');
        binding = undefined;
        capture = undefined;
        busy = false;
        error = undefined;
        lastToolbar = undefined;
        serial++;
    } if (!next) {
        if (attempt) {
            serial++;
            attempt = undefined;
        }
        return;
    } if (terminal === next.media) {
        setStatus(room, { supported, restart: true });
        return;
    } setStatus(room, { supported, restart: false }); if (!same(attempt, next)) {
        if (!inFlight)
            void attach(next);
        return;
    } if (binding && capture) {
        const size = dimensions(capture);
        if (size) {
            const active = binding, activeCapture = capture;
            void bridge.geometry({ captureId: activeCapture.captureId, ...size }).catch(() => { if (disposed || binding !== active || capture !== activeCapture)
                return; terminal = activeCapture.media; error = remotePcDesktopUnavailable; safeStop(active, 'error'); binding = undefined; setStatus(room, { supported, restart: true }); });
        }
        toolbar();
    } }
    const data = (bytes: Uint8Array, participant?: {
        sid: string;
    }, _kind?: unknown, topic?: string) => { if (!binding || !same(capture, current()) || !participant || !(bytes instanceof Uint8Array) || bytes.byteLength > 8192 || ![REMOTE_PC_MOVE_TOPIC, REMOTE_PC_RELIABLE_TOPIC].includes(topic || ''))
        return; void bridge?.receive({ captureId: binding.captureId, senderSid: participant.sid, topic: topic!, bytes }).catch(() => { }); };
    const removeState = bridge?.onState(value => { if (binding && exact(value as Scope, binding) && value.state === 'stopped') {
        terminal = capture?.media;
        error = remotePcDesktopUnavailable;
        binding = undefined;
        setStatus(room, { supported, restart: true });
    } });
    const removeIntent = bridge?.onIntent(intent => { const s = session(), issued = lastToolbar; if (!s || !issued || busy || !exact(intent, issued) || intent.revision !== s.revision || intent.sequence !== issued.sequence || issued.expiresAt <= Date.now())
        return; const scope = { sessionId: s.id, generation: s.generation, revision: s.revision }; let body: Record<string, unknown>; if (intent.action === 'delegate') {
        if (!eligible().some(p => p.identity === intent.participant.identity && p.sid === intent.participant.sid))
            return;
        body = { ...scope, action: 'delegate', controllerIdentity: intent.participant.identity, controllerSid: intent.participant.sid };
    }
    else if (intent.action === 'decide-request') {
        const r = read().requests.find(r => r.id === intent.requestId && r.sessionId === s.id && r.generation === s.generation && r.expiresAt > serverTime());
        if (!r || !eligible().some(p => p.identity === r.requester.identity && p.sid === r.requester.sid))
            return;
        body = { ...scope, action: 'decide-request', requestId: r.id, decision: intent.decision };
    }
    else if (intent.action === 'revoke')
        body = { ...scope, action: 'revoke' };
    else
        return; busy = true; error = undefined; toolbar(); const active = binding; void request(body).catch(() => { if (binding === active)
        error = 'PC control unavailable'; }).finally(() => { if (binding === active) {
        busy = false;
        toolbar();
    } }); });
    const events = [RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.Connected, RoomEvent.Reconnected, RoomEvent.Reconnecting, RoomEvent.Disconnected];
    events.forEach(e => room.on(e, sync));
    room.on(RoomEvent.DataReceived, data);
    const timer = bridge ? setInterval(sync, 250) : undefined;
    function probe() {
        probing = true;
        probeCapture = current()?.media;
        void bridge!.capabilities().then(result => {
            supported = result.version === 1 && result.supported && result.resourceVersion >= 2 && result.fullInputPause === true && result.publicationMode === 'client-owned';
        }).catch(() => { supported = false; }).finally(() => {
            probing = false;
            if(disposed)return;
            setStatus(room, { supported, restart: false });
            sync();
        });
    }
    probe();
    return { sync, dispose() { if (disposed)
            return; disposed = true; serial++; observed?.removeEventListener('ended', sync); if (binding)
            safeStop(binding, 'dispose'); if (timer)
            clearInterval(timer); events.forEach(e => room.off(e, sync)); room.off(RoomEvent.DataReceived, data); removeState?.(); removeIntent?.(); } };
}
