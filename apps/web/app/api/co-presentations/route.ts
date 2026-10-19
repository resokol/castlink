import { NextRequest, NextResponse } from 'next/server';
import { sameOrigin } from '@/lib/access';
import { defaultStudioId, validateStudioId } from '@/lib/studio-scope';
import { consumeRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { livePresentationGuest, presentationGuest } from '@/lib/co-presentation-access';
import { acknowledgeCoPresentation, coPresentations, createCoPresentation, currentCoPresentation, dropCoPresentation, navigateCoPresentation, samePresenter, syncCoPresentation } from '@/lib/co-presentation-state';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request: NextRequest) {
    if (!sameOrigin(request))
        return reply({ error: 'Invalid request origin' }, 403);
    try {
        if (Number(request.headers.get('content-length')) > 4096)
            return reply({ error: 'Request too large' }, 413);
        const raw = await request.text();
        if (raw.length > 4096)
            return reply({ error: 'Request too large' }, 413);
        let data;
        try {
            data = JSON.parse(raw);
        }
        catch {
            return reply({ error: 'Invalid request' }, 400);
        }
        if (!data || typeof data !== 'object' || Array.isArray(data))
            return reply({ error: 'Invalid request' }, 400);
        let studioId;
        try {
            studioId = validateStudioId(data.studioId || defaultStudioId());
        }
        catch {
            return reply({ error: 'Invalid studio' }, 400);
        }
        const room = data.room;
        if (typeof room !== 'string' || !room || room.length > 100)
            return reply({ error: 'Invalid room' }, 400);
        const principal = await presentationGuest(request, studioId, room);
        if (!principal)
            return reply({ error: 'Current caster session required' }, 401);
        const limit = consumeRateLimit(request, { scope: 'co-presentations', subject: `${studioId}:${principal.sid}`, limit: 300, windowMs: 60000 });
        if (!limit.ok)
            return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(limit) });
        const entries = coPresentations(studioId, room, principal.association);
        // A replaced/disconnected media connection cannot inherit an existing grant.
        await Promise.all(entries.map(async (entry) => {
            const savedOwner = entry.owner, savedController = entry.controller, controlRevision = entry.controlRevision;
            const [owner, controller] = await Promise.all([livePresentationGuest(studioId, room, savedOwner.identity), savedController ? livePresentationGuest(studioId, room, savedController.identity) : Promise.resolve(null)]);
            // Another request can replace the session or grant while lookup is pending.
            if (!currentCoPresentation(entry) || entry.owner !== savedOwner || entry.controller !== savedController || entry.controlRevision !== controlRevision)
                return;
            if (!owner || owner.association !== entry.association || !samePresenter(owner, savedOwner))
                dropCoPresentation(entry);
            else if (savedController && (!controller || controller.association !== entry.association || !samePresenter(controller, savedController))) {
                entry.controller = undefined;
                entry.controlRevision++;
            }
        }));
        const active = entries.filter(currentCoPresentation);
        if (data.action === 'read') {
            active.forEach(entry => { if (data.ownerSessionId === entry.id && samePresenter(principal, entry.owner))
                entry.updatedAt = Date.now(); });
            return reply({ sessions: active });
        }
        if (data.action === 'create') {
            if (typeof data.name !== 'string' || !data.name || data.name.length > 180 || /[\u0000-\u001f]/.test(data.name) || !Number.isSafeInteger(data.pages) || data.pages < 1 || data.pages > 10000)
                return reply({ error: 'Invalid presentation' }, 400);
            const initialPage = data.initialPage === undefined ? 1 : data.initialPage;
            if (!Number.isSafeInteger(initialPage) || initialPage < 1 || initialPage > data.pages || data.kind !== undefined && data.kind !== 'pdf' && data.kind !== 'powerpoint') return reply({ error: 'Invalid initial page or kind' }, 400);
            return reply({ session: createCoPresentation({ studioId, room, association: principal.association }, principal, data.name, data.pages, initialPage, data.kind || 'pdf') });
        }
        const session = active.find(entry => entry.id === data.id && entry.generation === data.generation);
        if (!session)
            return reply({ error: 'Presentation unavailable' }, 409);
        const owner = samePresenter(principal, session.owner);
        if (data.action === 'revoke') {
            if (!owner)
                return reply({ error: 'Owner required' }, 403);
            if (data.close === true)
                dropCoPresentation(session);
            else {
                session.controller = undefined;
                session.controlRevision++;
            }
        }
        else if (data.action === 'delegate') {
            if (!owner)
                return reply({ error: 'Owner required' }, 403);
            if (data.controlRevision !== session.controlRevision)
                return reply({ error: 'Control grant changed; refresh before retrying' }, 409);
            const controlRevision = session.controlRevision;
            const controller = typeof data.controllerIdentity === 'string' ? await livePresentationGuest(studioId, room, data.controllerIdentity) : null;
            // Check object identity after the asynchronous lookup; no stale re-grants.
            const latestOwner = await presentationGuest(request, studioId, room);
            if (!controller || controller.association !== session.association || samePresenter(controller, session.owner) || !currentCoPresentation(session) || session.controlRevision !== controlRevision || !latestOwner || !samePresenter(latestOwner, session.owner))
                return reply({ error: 'Caster unavailable' }, 409);
            session.controller = { identity: controller.identity, sid: controller.sid };
            session.controlRevision++;
        }
        else if (data.action === 'navigate') {
            if (session.controller ? !samePresenter(principal, session.controller) : !owner)
                return reply({ error: 'Control not granted' }, 403);
            if (data.controlRevision !== session.controlRevision)
                return reply({ error: 'Control grant changed; refresh before retrying' }, 409);
            if (data.direction !== 'next' && data.direction !== 'previous')
                return reply({ error: 'Invalid direction' }, 400);
            if (!navigateCoPresentation(session, data.direction, data.revision))
                return reply({ error: 'Page is still rendering; refresh before retrying' }, 409);
        }
        else if (data.action === 'sync') {
            if (!owner) return reply({ error: 'Owner required' }, 403);
            if (!syncCoPresentation(session, data.revision, data.page)) return reply({ error: 'Stale or pending slide' }, 409);
        }
        else if (data.action === 'ack') {
            if (!owner)
                return reply({ error: 'Owner required' }, 403);
            if (!acknowledgeCoPresentation(session, data.generation, data.revision, data.page))
                return reply({ error: 'Stale rendered page' }, 409);
        }
        else
            return reply({ error: 'Invalid action' }, 400);
        if (owner)
            session.updatedAt = Date.now();
        return reply({ session: currentCoPresentation(session) ? session : null });
    }
    catch {
        return reply({ error: 'Presentation control unavailable' }, 503);
    }
}
