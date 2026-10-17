/** Recent sources are a convenience list; scene bindings are stored separately. */
export type RememberedSource = { identity: string; name: string; source: 'camera'|'screen'; disconnectedAt?: number };
export const SOURCE_RETENTION_MS = 15 * 60 * 1000;
const key = (source: RememberedSource) => JSON.stringify([source.identity, source.source]);
export function refreshSourceCatalog(previous: RememberedSource[], live: RememberedSource[], now: number): RememberedSource[] {
  const current = new Map(live.map(s => [key(s), {identity:s.identity,name:s.name,source:s.source}]));
  const result: RememberedSource[] = [...current.values()];
  for (const source of previous) {
    if (current.has(key(source))) continue;
    const disconnectedAt = Number.isFinite(source.disconnectedAt) ? Math.min(source.disconnectedAt!, now) : now;
    if (now - disconnectedAt < SOURCE_RETENTION_MS) result.push({...source,disconnectedAt});
  }
  return result.slice(0,256);
}
