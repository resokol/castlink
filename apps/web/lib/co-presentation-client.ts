import { LocalVideoTrack, RoomEvent, Track, type Room } from 'livekit-client';
import type { CoPresentation } from './co-presentation-state';
export async function coPresentationRequest(token: string, studioId: string, room: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<{
    session?: CoPresentation | null;
    sessions?: CoPresentation[];
}> {
    const cancellation = new AbortController();
    const abort = () => cancellation.abort();
    const timer = setTimeout(abort, 5000);
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
    try {
        const response = await fetch('/api/co-presentations', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ studioId, room, ...body }), cache: 'no-store', signal: cancellation.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw Object.assign(new Error(typeof data.error === 'string' ? data.error : 'Presentation control unavailable'), { status: response.status });
        return data;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
const canvasTracks = new WeakSet<object>();
export function isCoPresentationTrack(track: object | undefined) { return !!track && canvasTracks.has(track); }
/** Owns one silent canvas track. Cleanup never looks up or stops camera/microphone tracks. */
export function createCanvasPresentationCapture(room: Room, changed: (sharing: boolean) => void) {
    let owned: LocalVideoTrack | undefined, generation = 0, disposed = false;
    let refreshTimer: ReturnType<typeof setInterval> | undefined;
    const stop = async () => {
        generation++;
        if (refreshTimer !== undefined) { clearInterval(refreshTimer); refreshTimer = undefined; }
        const track = owned;
        owned = undefined;
        if (!track)
            return;
        track.stop();
        changed(false);
        try {
            await room.localParticipant.unpublishTrack(track);
        }
        catch { /* Already disconnected/unpublished. */ }
        canvasTracks.delete(track);
    };
    const unpublished = (publication: {
        track?: unknown;
    }) => { if (owned && publication.track === owned)
        void stop(); };
    const disconnected = () => { void stop(); };
    room.on(RoomEvent.LocalTrackUnpublished, unpublished).on(RoomEvent.Disconnected, disconnected);
    return {
        isSharing: () => !!owned && owned.mediaStreamTrack.readyState === 'live' && room.state === 'connected',
        stop,
        async start(canvas: HTMLCanvasElement, current: () => boolean) {
            if (disposed || owned || room.state !== 'connected' || room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track)
                throw new Error('Stop the current screen share first');
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Canvas capture unavailable');
            const request = ++generation;
            const stream = canvas.captureStream(5);
            const raw = stream.getVideoTracks()[0];
            if (!raw) {
                stream.getTracks().forEach(track => track.stop());
                throw new Error('Canvas capture unavailable');
            }
            const track = new LocalVideoTrack(raw, undefined, true);
            owned = track;
            canvasTracks.add(track);
            raw.addEventListener('ended', () => { if (owned === track)
                void stop(); }, { once: true });
            const valid = () => !disposed && current() && request === generation && owned === track && room.state === 'connected';
            // captureStream's rate is a limit, not a heartbeat. A PDF is already
            // painted before asynchronous publication; without another draw the
            // encoder/subscriber can miss its only frame and display a blank slide.
            const refresh = () => {
                if (!valid()) return;
                context.save();
                try {
                    context.resetTransform();
                    context.globalAlpha = 1;
                    context.globalCompositeOperation = 'copy';
                    context.filter = 'none';
                    context.shadowColor = 'transparent';
                    context.shadowBlur = 0;
                    context.shadowOffsetX = 0;
                    context.shadowOffsetY = 0;
                    context.drawImage(canvas, 0, 0);
                } catch { void stop(); }
                finally { context.restore(); }
            };
            refreshTimer = setInterval(refresh, 200);

            try {
                if (!valid() || room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track) {
                    await stop();
                    return false;
                }
                await room.localParticipant.publishTrack(track, { source: Track.Source.ScreenShare, name: 'CastLink presentation', simulcast: false });
                if (!valid() || room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track !== track) {
                    // A late publish must be removed even if a prior stop already cleared ownership.
                    track.stop();
                    await room.localParticipant.unpublishTrack(track).catch(() => undefined);
                    if (owned === track)
                        await stop();
                    canvasTracks.delete(track);
                    return false;
                }
                refresh();
                if (!valid() || raw.readyState !== 'live') return false;
                changed(true);
                return true;
            }
            catch (cause) {
                if (owned === track)
                    await stop();
                else
                    track.stop();
                throw cause;
            }
        },
        dispose() { disposed = true; room.off(RoomEvent.LocalTrackUnpublished, unpublished).off(RoomEvent.Disconnected, disconnected); void stop(); },
    };
}
