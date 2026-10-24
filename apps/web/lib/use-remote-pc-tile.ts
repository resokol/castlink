'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { type Participant, type Room, type TrackPublication, Track } from 'livekit-client';
import { useRemotePc } from './use-remote-pc';
import { remotePcCredential, remotePcServerTime, remotePcInputSequences, remotePcRequest, remotePcSnapshot } from './remote-pc-client';
import { createRemotePcInputSender, remotePcVideoPoint, remotePcVideoGeometry, remotePcTextChunks, type RemotePcPoint, type RemotePcBrowserInput } from './remote-pc-input';
import { REMOTE_PC_MOVE_TOPIC, REMOTE_PC_RELIABLE_TOPIC, remotePcInputMacPayload, type RemotePcUnsignedInput, type RemotePcInputEvent } from './remote-pc-protocol';
const surfaces = new WeakMap<Room, () => void>();
export function useRemotePcTile(room: Room, ref: RefObject<HTMLElement | null>, track: {
    participant: Participant;
    publication?: TrackPublication;
    source: Track.Source;
}, readOnly = false) {
    const view = useRemotePc(room), [focused, setFocused] = useState(false), [paused, setPaused] = useState(false), [userPaused, setUserPaused] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(false), [requestEnded, setRequestEnded] = useState(false);
    const actions = useRef<{
        release(): void;
        text(value: string): Promise<void>;
        chord(codes: string[]): Promise<void>;
    } | undefined>(undefined), finished = useRef('');
    const sourceSession = track.source === Track.Source.ScreenShare ? view.sessions.find(s => s.phase === 'sharing' && s.source?.helper.identity === track.participant.identity && s.source.helper.sid === track.participant.sid && s.source.videoTrackSid === track.publication?.trackSid) : undefined;
    const session = sourceSession?.grant?.controller.identity === room.localParticipant.identity && sourceSession.grant.controller.sid === room.localParticipant.sid && sourceSession.grant.phase === 'active' ? sourceSession : undefined;
    const own = sourceSession?.owner.identity === room.localParticipant.identity && sourceSession.owner.sid === room.localParticipant.sid;
    let human = false;
    try {
        const metadata = JSON.parse(room.localParticipant.metadata || '{}');
        human = !metadata.roomChatOnly && (metadata.role ? ['guest', 'studio-panel', 'studio-moderator', 'admin', 'moderator'].includes(metadata.role) : /^(guest-|studio-panel-|studio-moderator-)/.test(room.localParticipant.identity));
    }
    catch { }
    const interactive = !readOnly && human && !/^(output|monitor|watch|remote-pc-|talkback-|stream-viewer-)/.test(room.localParticipant.identity);
    const requestable = interactive && !own && track.source === Track.Source.ScreenShare && !!track.publication?.track && !track.participant.isLocal;
    const pending = !!sourceSession && view.requests?.some(r => r.sessionId === sourceSession.id && r.generation === sourceSession.generation && r.requester.identity === room.localParticipant.identity && r.requester.sid === room.localParticipant.sid && r.expiresAt > remotePcServerTime(room));
    const wasPending = useRef('');
    useEffect(() => { const key = sourceSession ? sourceSession.id + '/' + sourceSession.generation : ''; if (pending) {
        wasPending.current = key;
        setRequestEnded(false);
    }
    else if (session) {
        wasPending.current = '';
        setRequestEnded(false);
    }
    else if (key && wasPending.current === key) {
        wasPending.current = '';
        setRequestEnded(true);
    }
    else if (wasPending.current && wasPending.current !== key) {
        wasPending.current = '';
        setRequestEnded(false);
    } }, [pending, sourceSession?.id, sourceSession?.generation, session?.grant?.id]);
    const held = useRef({ grant: '', keys: new Set<string>(), buttons: new Set<0 | 1 | 2>() });
    if (session?.grant?.id && held.current.grant !== session.grant.id)
        held.current = { grant: session.grant.id, keys: new Set(), buttons: new Set() };
    const active = interactive && !!session && view.ready && !userPaused && finished.current !== session.grant?.id && session.source?.inputStatus?.state === 'ready' && session.source.inputStatus.pointerReady === true;
    useEffect(() => { setUserPaused(false); setError(false); }, [session?.grant?.id]);
    useEffect(() => { const keyUp = (event: KeyboardEvent) => held.current.keys.delete(event.code), pointerUp = (event: PointerEvent) => held.current.buttons.delete(event.button as 0 | 1 | 2); window.addEventListener('keyup', keyUp); window.addEventListener('pointerup', pointerUp); return () => { window.removeEventListener('keyup', keyUp); window.removeEventListener('pointerup', pointerUp); }; }, [session?.grant?.id]);
    useEffect(() => {
        const shell = ref.current;
        if (!shell || !session?.grant || !active)
            return;
        const id = session.id, grantId = session.grant.id, geometryRevision = session.source!.geometry.revision, heldKeys = held.current.keys, heldButtons = held.current.buttons;
        let disposed = false, accepting = true, focus = false, normalCaptureEnd: number | undefined, moveBarrier = remotePcInputSequences(room, grantId).move, key: CryptoKey | undefined, keyValue = '';
        const remoteKeys = new Set<string>(), remoteButtons = new Set<0 | 1 | 2>();
        let lastPoint: RemotePcPoint | undefined;
        const credential = () => { const c = remotePcCredential(room, id); return c?.grantId === grantId && c.geometryRevision === geometryRevision ? c : undefined; };
        const latestReady = () => { const snapshot = remotePcSnapshot(room), latest = snapshot.sessions.find(s => s.id === id && s.generation === session.generation); return snapshot.ready && latest?.source?.geometry.revision === geometryRevision && latest.source.inputStatus?.state === 'ready' && latest.source.inputStatus.pointerReady === true && latest.grant?.id === grantId && latest.grant.phase === 'active'; };
        const live = () => latestReady() && accepting && !disposed && room.state === 'connected' && finished.current !== grantId && !!credential() && !!track.publication?.track && !track.publication.isMuted && track.publication.track.mediaStreamTrack.readyState === 'live';
        const geometry = () => { const video = shell.querySelector('video'); if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight || video.paused || video.ended)
            return; let node: Element | null = video; while (node) {
            const css = getComputedStyle(node);
            if (css.transform && css.transform !== 'none' || css.rotate && css.rotate !== 'none' && css.rotate !== '0deg' || css.scale && css.scale !== 'none' && css.scale !== '1')
                return;
            node = node.parentElement;
        } const css = getComputedStyle(video), rect = video.getBoundingClientRect();
            if(!remotePcVideoGeometry(rect,video.videoWidth,video.videoHeight,css.objectFit,css.objectPosition))return;
            return { video, css, rect }; };
        const authorized = () => {
            const valid=live()&&!document.hidden&&!!geometry()&&(document.activeElement===shell||!!document.activeElement&&shell.contains?.(document.activeElement));
            if(focus&&!valid){setPaused(true);release();}
            return focus&&valid;
        };
        const current = () => authorized() && document.activeElement === shell;
        const send = async (payload: RemotePcBrowserInput, lane: 'move' | 'reliable', seq: number, deadline: number) => {
            const grant = credential();
            if (!grant) { if(payload.type!=='releaseAll')throw new Error('Remote PC focus changed'); return; }
            if(payload.type!=='releaseAll'&&!authorized())throw new Error('Remote PC focus changed');
            if (payload.type === 'button')
                moveBarrier = payload.moveBarrier || moveBarrier;
            let event: RemotePcInputEvent;
            if (payload.type === 'button') {
                const { moveBarrier: _, ...rest } = payload;
                event = { ...rest, button: rest.button === 'left' ? 0 : rest.button === 'middle' ? 1 : 2 };
            }
            else if (payload.type === 'key')
                event = { ...payload, repeat: false };
            else
                event = payload;
            if (event.type === 'move' || event.type === 'button' || event.type === 'wheel')
                event = { ...event, x: Math.round(event.x * 65535), y: Math.round(event.y * 65535) };
            if (event.type === 'wheel')
                event = { ...event, deltaX: Math.round(event.deltaX), deltaY: Math.round(event.deltaY) };
            if (keyValue !== grant.inputKey) {
                const bytes = Uint8Array.from(atob(grant.inputKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
                key = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
                keyValue = grant.inputKey;
            }
            const unsigned: RemotePcUnsignedInput = { v: 1, sessionId: grant.sessionId, generation: grant.generation, captureId: grant.captureId, grantId: grant.grantId, revision: grant.revision, geometryRevision: grant.geometryRevision, lane, seq, expiresAt: Math.min(deadline + remotePcServerTime(room) - Date.now(), grant.expiresAt), moveBarrier, event };
            const signature = await crypto.subtle.sign('HMAC', key!, new TextEncoder().encode(remotePcInputMacPayload(unsigned))), latest = credential();
            if (disposed || !latest || JSON.stringify(latest) !== JSON.stringify(grant) || payload.type !== 'releaseAll' && !authorized()) {
                if(payload.type!=='releaseAll')throw new Error('Remote PC focus changed');
                return;
            }
            if (unsigned.expiresAt <= remotePcServerTime(room))
                throw new Error('Remote PC input expired');
            const mac = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ ...unsigned, mac })), { reliable: lane === 'reliable', topic: lane === 'move' ? REMOTE_PC_MOVE_TOPIC : REMOTE_PC_RELIABLE_TOPIC, destinationIdentities: [grant.helper.identity] });
        };
        const sender = createRemotePcInputSender({ sequences: remotePcInputSequences(room, grantId), current: () => !disposed && !!credential(), send });
        const release = () => { focus = false; remoteKeys.clear();remoteButtons.clear();setFocused(false); void sender.release().catch(() => setPaused(true)); };
        const requireFocus = () => { if (!authorized() || heldKeys.size || heldButtons.size)
            throw new Error('Click video to focus; release held keys and buttons'); };
        actions.current = { release, async text(value) { requireFocus(); for (const text of remotePcTextChunks(value)) {
                requireFocus();
                await sender.reliable({ type: 'text', text });
                requireFocus();
            } }, async chord(codes) { requireFocus(); for (const code of codes)
                await sender.reliable({ type: 'key', code, down: true }); for (const code of [...codes].reverse())
                await sender.reliable({ type: 'key', code, down: false }); } };
        const point = (event: {
            clientX: number;
            clientY: number;
        }) => { const g = geometry(); return g ? remotePcVideoPoint(g.rect, g.video.videoWidth, g.video.videoHeight, event.clientX, event.clientY, g.css.objectFit, g.css.objectPosition) : undefined; };
        const pointer = (event: PointerEvent) => {
            if (event.target !== shell.querySelector('video') && !shell.hasPointerCapture?.(event.pointerId))
                return;
            if (event.type === 'pointerup') {
                heldButtons.delete(event.button as 0 | 1 | 2);
                remoteButtons.delete(event.button as 0 | 1 | 2);
                normalCaptureEnd = event.pointerId;
            }
            const p = point(event);
            if (!p) {
                setPaused(true);
                if (focus)
                    release();
                return;
            }
            if (event.type === 'pointerdown') {
                normalCaptureEnd = undefined;
                if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || !live() || heldKeys.size || heldButtons.size) {
                    setPaused(true);
                    return;
                }
                const previous=surfaces.get(room);if(previous&&previous!==release)previous();
                surfaces.set(room, release);
                shell.focus({ preventScroll: true });
                focus = true;
                setFocused(true);
                setPaused(false);
                void sender.reliable({ type: 'heartbeat', pressedKeys: [], pressedButtons: [] }).catch(release);
                shell.setPointerCapture?.(event.pointerId);
            }
            if (!current())
                return;
            event.preventDefault();
            event.stopPropagation();
            lastPoint=p;
            if (event.type === 'pointermove')
                sender.move(p);
            else if (event.button >= 0 && event.button <= 2) {
                const button = event.button as 0 | 1 | 2, down = event.type === 'pointerdown';
                if (down) { heldButtons.add(button); remoteButtons.add(button); }
                else { heldButtons.delete(button); remoteButtons.delete(button); }
                void sender.reliable({ type: 'button', button: button === 0 ? 'left' : button === 1 ? 'middle' : 'right', down, ...p }).catch(() => { setPaused(true); release(); });
            }
        };
        const keyEvent = (event: KeyboardEvent) => {
            const matchingKeyUp = event.type === 'keyup' && heldKeys.has(event.code);
            if (event.type === 'keyup') { heldKeys.delete(event.code); remoteKeys.delete(event.code); }
            if (!current() || event.target !== shell || event.isComposing || event.key === 'Process' || event.key === 'Dead')
                return;
            event.preventDefault();
            event.stopPropagation();
            if (matchingKeyUp) {
                void sender.reliable({ type: 'key', code: event.code, down: false }).catch(release);
                return;
            }
            if ([...event.key].length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
                if (event.type === 'keydown')
                    void sender.reliable({ type: 'text', text: event.key }).catch(release);
                return;
            }
            if (event.repeat)
                return;
            const down = event.type === 'keydown';
            if (down) { heldKeys.add(event.code); remoteKeys.add(event.code); }
            else { heldKeys.delete(event.code); remoteKeys.delete(event.code); }
            void sender.reliable({ type: 'key', code: event.code, down }).catch(release);
        };
        const wheel = (event: WheelEvent) => { if (!current() || event.target !== shell.querySelector('video'))
            return; const p = point(event); if (!p) {
            if (focus)
                release();
            return;
        } event.preventDefault(); event.stopPropagation(); const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? shell.clientHeight : 1; void sender.reliable({ type: 'wheel', ...p, deltaX: Math.max(-4096, Math.min(4096, event.deltaX * factor)), deltaY: Math.max(-4096, Math.min(4096, event.deltaY * factor)) }).catch(release); };
        const captureLost = (event: PointerEvent) => { if (normalCaptureEnd === event.pointerId) {
            normalCaptureEnd = undefined;
            return;
        } release(); };
        const context = (event: Event) => { if (current())
            event.preventDefault(); }, hidden = () => { if (document.hidden)
            release(); };
        const blur = (event: FocusEvent) => { if (event.relatedTarget && shell.contains?.(event.relatedTarget as Node)) {
            // Preserve native synchronization: release held effects without a releaseAll reset.
            if(focus&&live()&&geometry()){
                const keys=[...remoteKeys],buttons=[...remoteButtons],point=lastPoint;
                remoteKeys.clear();remoteButtons.clear();
                for(const code of keys)void sender.reliable({type:'key',code,down:false}).catch(release);
                if(point)for(const button of buttons)void sender.reliable({type:'button',button:button===0?'left':button===1?'middle':'right',down:false,...point}).catch(release);
            }else if(focus)release();
            return;
        } release(); };
        shell.addEventListener('pointerdown', pointer);
        shell.addEventListener('pointerup', pointer);
        shell.addEventListener('pointermove', pointer);
        shell.addEventListener('pointercancel', release);
        shell.addEventListener('lostpointercapture', captureLost);
        shell.addEventListener('keydown', keyEvent);
        shell.addEventListener('keyup', keyEvent);
        shell.addEventListener('blur', blur);
        shell.addEventListener('focusout', blur);
        shell.addEventListener('wheel', wheel, { passive: false });
        shell.addEventListener('contextmenu', context);
        window.addEventListener('blur', release);
        document.addEventListener('visibilitychange', hidden);
        const heartbeat = window.setInterval(() => { if (focus && (!geometry() || !live())) {
            setPaused(true);
            release();
            return;
        } if (authorized())
            void sender.reliable({ type: 'heartbeat', pressedKeys: [...remoteKeys].filter(code=>heldKeys.has(code)), pressedButtons: [...remoteButtons].filter(button=>heldButtons.has(button)) }).catch(release); }, 200);
        return () => { accepting = false; actions.current = undefined; release(); if (surfaces.get(room) === release)
            surfaces.delete(room); void sender.flush().finally(() => { disposed = true; sender.dispose(); }); window.clearInterval(heartbeat); shell.removeEventListener('pointerdown', pointer); shell.removeEventListener('pointerup', pointer); shell.removeEventListener('pointermove', pointer); shell.removeEventListener('pointercancel', release); shell.removeEventListener('lostpointercapture', captureLost); shell.removeEventListener('keydown', keyEvent); shell.removeEventListener('keyup', keyEvent); shell.removeEventListener('blur', blur); shell.removeEventListener('focusout', blur); shell.removeEventListener('wheel', wheel); shell.removeEventListener('contextmenu', context); window.removeEventListener('blur', release); document.removeEventListener('visibilitychange', hidden); };
    }, [room, ref, session?.id, session?.generation, session?.grant?.id, session?.grant?.revision, session?.source?.geometry.revision, session?.source?.inputStatus?.pointerReady, active, track.publication, track.publication?.track, track.participant.sid]);
    const request = async () => { if (busy || pending || !requestable)
        return; setError(false); setRequestEnded(false); if (!sourceSession) {
        setError(true);
        return;
    } setBusy(true); try {
        await remotePcRequest(room, { action: 'request-control', sessionId: sourceSession.id, generation: sourceSession.generation, revision: sourceSession.revision });
    }
    catch {
        setError(true);
    }
    finally {
        setBusy(false);
    } };
    const stop = async () => { if (!interactive || !session?.grant)
        return; finished.current = session.grant.id; actions.current?.release(); setUserPaused(true); setBusy(true); setError(false); try {
        await remotePcRequest(room, { action: 'finish-control', sessionId: session.id, generation: session.generation, revision: session.revision, grantId: session.grant.id });
    }
    catch {
        setError(true);
    }
    finally {
        setBusy(false);
    } };
    return { available: interactive && !!session, requestable, sourceAvailable: !!sourceSession, pending, requestEnded, busy, error, controllerName: sourceSession?.grant ? (room.remoteParticipants.get(sourceSession.grant.controller.identity)?.name || sourceSession.grant.controller.identity) : undefined, active, focused, paused, userPaused, request, stop, text: (value: string) => actions.current?.text(value) ?? Promise.reject(new Error('Click video to focus')), chord: (codes: string[]) => actions.current?.chord(codes) ?? Promise.reject(new Error('Click video to focus')) };
}
