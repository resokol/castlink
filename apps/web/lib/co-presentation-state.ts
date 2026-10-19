import { randomUUID } from 'node:crypto';
export type CoPresenter = {
    identity: string;
    sid: string;
};
export type CoPresentation = {
    id: string;
    generation: string;
    studioId: string;
    room: string;
    association: string;
    owner: CoPresenter;
    controller?: CoPresenter;
    controlRevision: number;
    kind: 'pdf' | 'powerpoint';
    name: string;
    pages: number;
    page: number;
    renderedPage: number;
    revision: number;
    renderedRevision: number;
    updatedAt: number;
};
const sessions = new Map<string, CoPresentation>();
export const samePresenter = (a: CoPresenter, b?: CoPresenter) => !!b && a.identity === b.identity && a.sid === b.sid;
export function coPresentations(studioId: string, room: string, association: string, now = Date.now()) {
    for (const [id, item] of sessions)
        if (now - item.updatedAt > 30000 || item.studioId === studioId && item.room === room && item.association !== association)
            sessions.delete(id);
    return [...sessions.values()].filter(item => item.studioId === studioId && item.room === room && item.association === association);
}
export function createCoPresentation(scope: Pick<CoPresentation, 'studioId' | 'room' | 'association'>, owner: CoPresenter, name: string, pages: number, initialPage = 1, kind: CoPresentation['kind'] = 'pdf') {
    for (const item of coPresentations(scope.studioId, scope.room, scope.association))
        if (item.owner.identity === owner.identity)
            sessions.delete(item.id);
    if (sessions.size >= 512)
        throw new Error('Presentation capacity reached');
    const session: CoPresentation = { ...scope, owner, controlRevision: 0, id: randomUUID(), generation: randomUUID(), name, pages, kind, page: initialPage, renderedPage: 0, revision: 0, renderedRevision: -1, updatedAt: Date.now() };
    sessions.set(session.id, session);
    return session;
}
export function dropCoPresentation(session: CoPresentation) { if (sessions.get(session.id) === session)
    sessions.delete(session.id); }
export function currentCoPresentation(session: CoPresentation) { return sessions.get(session.id) === session; }
export function navigateCoPresentation(session: CoPresentation, direction: 'next' | 'previous', revision: number) {
    if (!currentCoPresentation(session) || revision !== session.revision || session.renderedRevision !== session.revision)
        return false;
    const page = Math.max(1, Math.min(session.pages, session.page + (direction === 'next' ? 1 : -1)));
    if (page !== session.page) {
        session.page = page;
        session.revision++;
    }
    return true;
}
export function acknowledgeCoPresentation(session: CoPresentation, generation: string, revision: number, page: number) {
    if (!currentCoPresentation(session) || generation !== session.generation || revision !== session.revision || page !== session.page)
        return false;
    session.renderedPage = page;
    session.renderedRevision = revision;
    return true;
}

/** Owner reports manual PowerPoint slide changes only when no remote render is pending. */
export function syncCoPresentation(session: CoPresentation, revision: number, page: number) {
    if (!currentCoPresentation(session) || session.kind !== 'powerpoint' || revision !== session.revision || session.renderedRevision !== session.revision || !Number.isSafeInteger(page) || page < 1 || page > session.pages) return false;
    if (session.page !== page) { session.page = page; session.revision++; }
    session.renderedPage = page; session.renderedRevision = session.revision; return true;
}
