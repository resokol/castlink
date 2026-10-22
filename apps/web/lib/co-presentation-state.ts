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
    navigationMode?: 'powerpoint-steps-v1';
    commandSeq?: number;
    command?: PowerPointStepCommand;
    lastCommand?: { id: string; seq: number; status: 'applied' | 'failed' | 'expired' };
};
export type PowerPointStepCommand = { id: string; seq: number; direction: 'next' | 'previous'; issuedAt: number; expiresAt: number; generation: string; controlRevision: number };
export function expirePowerPointStep(session: CoPresentation, now = Date.now()) {
    if (session.command && session.command.expiresAt <= now) {
        session.lastCommand = { id: session.command.id, seq: session.command.seq, status: 'expired' };
        session.command = undefined;
    }
}
export function acknowledgePowerPointStep(session: CoPresentation, generation: string, id: string, page: number, ok: boolean, observedRevision: number) {
    expirePowerPointStep(session);
    const command = session.command;
    if (!currentCoPresentation(session) || session.navigationMode !== 'powerpoint-steps-v1' || generation !== session.generation || !command || command.id !== id || command.controlRevision !== session.controlRevision || !Number.isSafeInteger(page) || page < 1 || page > session.pages || !Number.isSafeInteger(observedRevision) || observedRevision < 0 || observedRevision > session.revision) return false;
    // Completion and observed position have different identities. A newer
    // manual observation must survive an older result for this same command.
    if (observedRevision === session.revision) session.page = page;
    session.renderedPage = session.page;
    session.renderedRevision = session.revision;
    session.lastCommand = { id, seq: command.seq, status: ok ? 'applied' : 'failed' };
    session.command = undefined;
    return true;
}
const sessions = new Map<string, CoPresentation>();
export const samePresenter = (a: CoPresenter, b?: CoPresenter) => !!b && a.identity === b.identity && a.sid === b.sid;
export function coPresentations(studioId: string, room: string, association: string, now = Date.now()) {
    for (const [id, item] of sessions)
        if (now - item.updatedAt > 30000 || item.studioId === studioId && item.room === room && item.association !== association)
            sessions.delete(id);
        else expirePowerPointStep(item, now);
    return [...sessions.values()].filter(item => item.studioId === studioId && item.room === room && item.association === association);
}
export function createCoPresentation(scope: Pick<CoPresentation, 'studioId' | 'room' | 'association'>, owner: CoPresenter, name: string, pages: number, initialPage = 1, kind: CoPresentation['kind'] = 'pdf', navigationMode?: CoPresentation['navigationMode']) {
    for (const item of coPresentations(scope.studioId, scope.room, scope.association))
        if (item.owner.identity === owner.identity)
            sessions.delete(item.id);
    if (sessions.size >= 512)
        throw new Error('Presentation capacity reached');
    const session: CoPresentation = { ...scope, owner, controlRevision: 0, id: randomUUID(), generation: randomUUID(), name, pages, kind, page: initialPage, renderedPage: 0, revision: 0, renderedRevision: -1, updatedAt: Date.now() };
    if (kind === 'powerpoint' && navigationMode === 'powerpoint-steps-v1') { session.navigationMode = navigationMode; session.commandSeq = 0; }
    sessions.set(session.id, session);
    return session;
}
export function dropCoPresentation(session: CoPresentation) { if (sessions.get(session.id) === session)
    sessions.delete(session.id); }
export function currentCoPresentation(session: CoPresentation) { return sessions.get(session.id) === session; }
export function navigateCoPresentation(session: CoPresentation, direction: 'next' | 'previous', revision: number) {
    if (session.navigationMode === 'powerpoint-steps-v1') {
        expirePowerPointStep(session);
        if (!currentCoPresentation(session) || revision !== session.revision || session.command) return false;
        const now = Date.now(), seq = (session.commandSeq || 0) + 1;
        session.commandSeq = seq;
        session.command = { id: randomUUID(), seq, direction, issuedAt: now, expiresAt: now + 3000, generation: session.generation, controlRevision: session.controlRevision };
        session.revision++;
        return true;
    }
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
    if (session.navigationMode === 'powerpoint-steps-v1') {
        if (!currentCoPresentation(session) || session.kind !== 'powerpoint' || revision !== session.revision || !Number.isSafeInteger(page) || page < 1 || page > session.pages) return false;
        if (session.page !== page) { session.page = page; session.revision++; }
        session.renderedPage = page;
        session.renderedRevision = session.revision;
        return true;
    }
    if (!currentCoPresentation(session) || session.kind !== 'powerpoint' || revision !== session.revision || session.renderedRevision !== session.revision || !Number.isSafeInteger(page) || page < 1 || page > session.pages) return false;
    if (session.page !== page) { session.page = page; session.revision++; }
    session.renderedPage = page; session.renderedRevision = session.revision; return true;
}
