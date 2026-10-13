import { createHash, randomUUID } from 'node:crypto';
import type { ReserveCohort } from './server-reserve';
import type { ServerPeer } from './server-profiles';
import { requestServerPeer } from './server-peer-request';
import { signBridge } from './server-transfer';
import { transferIdentity } from './transfer-peer';

export type ReserveHealthOutcome = 'healthy' | 'failed' | 'ambiguous';
type HealthBinding = { installationId: string; studioId: string; roomId: string; challenge?: string };
export function classifyReserveHealth(status: number, value: unknown, expected: HealthBinding): ReserveHealthOutcome {
  if (status >= 500 && status <= 599) return 'failed';
  if (status !== 200 || !value || typeof value !== 'object') return 'ambiguous';
  const result = value as Record<string, unknown>;
  if (Object.entries(expected).some(([key, item]) => result[key] !== item)) return 'ambiguous';
  return result.liveKitReady === true ? 'healthy' : result.liveKitReady === false ? 'failed' : 'ambiguous';
}
export function classifyReserveHealthError(error: unknown): ReserveHealthOutcome {
  const e = error as { code?: string; name?: string; cause?: { code?: string; name?: string } };
  const code = e?.cause?.code || e?.code;
  return ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN', 'ENOTFOUND'].includes(code || '') || e?.name === 'TimeoutError' ? 'failed' : 'ambiguous';
}
type Observation = { first: number; last: number; count: number; checkedAt: number; failed: boolean; pending?: Promise<boolean> };
/** Evidence is local to this process; restart, a long gap, or ambiguity starts a fresh window. */
export class ReserveFailureHistory {
  private observations = new Map<string, Observation>();
  confirmed(binding: string, now = Date.now()) {
    const row = this.observations.get(binding);
    return !!row && row.failed && row.count >= 3 && row.last - row.first >= 15000 && now >= row.last && now - row.last <= 10000;
  }
  async check(binding: string, probe: () => Promise<ReserveHealthOutcome>, clock = () => Date.now()): Promise<boolean> {
    const at = clock();
    let row = this.observations.get(binding);
    if (row?.pending) return row.pending;
    if (row && at >= row.checkedAt && at - row.checkedAt < 5000) return this.confirmed(binding, at);
    if (!row || at < row.last || at - row.last > 10000) row = { first: at, last: at, count: 0, checkedAt: at, failed: false };
    row.checkedAt = at;
    const observation = row;
    this.observations.set(binding, observation);
    observation.pending = Promise.resolve().then(async () => {
      let outcome: ReserveHealthOutcome;
      try { outcome = await probe(); } catch (error) { outcome = classifyReserveHealthError(error); }
      const end = clock();
      if (outcome === 'failed' && end >= at && end - at <= 10000) {
        if (!observation.failed || at < observation.last || at - observation.last > 10000) { observation.first = at; observation.count = 0; }
        observation.count++; observation.last = at; observation.failed = true;
      } else { observation.count = 0; observation.first = end; observation.last = end; observation.failed = false; }
      observation.pending = undefined;
      return this.confirmed(binding, end);
    });
    // Bound old bindings without affecting an in-flight probe.
    for (const [key, value] of this.observations) if (!value.pending && at - value.last > 300000) this.observations.delete(key);
    return observation.pending;
  }
}
export function automaticFailureHistory() {
  const symbol = Symbol.for('castlink.reserve-failure-history');
  const shared = globalThis as typeof globalThis & { [key: symbol]: ReserveFailureHistory | undefined };
  return shared[symbol] ||= new ReserveFailureHistory();
}
/** No reserve queue is held by the caller while this authenticated network probe runs. */
export async function probeReserveSource(cohort: ReserveCohort, peer: ServerPeer): Promise<ReserveHealthOutcome> {
  if (peer.origin !== cohort.sourceOrigin || peer.installationId !== cohort.sourceInstallationId || createHash('sha256').update(peer.secret).digest('hex') !== cohort.peerSecretVersion) return 'ambiguous';
  const identity = await transferIdentity(), challenge = randomUUID();
  const body = JSON.stringify({ action: 'health', peerId: peer.id, sourceOrigin: identity.origin, sourceInstallationId: identity.installationId, roomId: cohort.roomId, studioId: cohort.studioId, challenge });
  const timestamp = String(Date.now()), nonce = randomUUID().replaceAll('-', '');
  try {
    const response = await requestServerPeer(peer, '/api/server-reserve?action=bridge', { method: 'POST', body, timeoutMs: 3000, headers: { 'content-type': 'application/json', 'x-studiolink-transfer-time': timestamp, 'x-studiolink-transfer-nonce': nonce, 'x-studiolink-transfer-signature': signBridge(timestamp, nonce, body, peer.secret) } });
    if (response.status >= 500) return 'failed';
    const result = await response.json().catch(() => undefined);
    return classifyReserveHealth(response.status, result, { installationId: cohort.sourceInstallationId, studioId: cohort.studioId, roomId: cohort.roomId, challenge });
  } catch (error) { return classifyReserveHealthError(error); }
}
