import type { ConnectionHistory, TelemetryRole } from "./telemetry-types";

export type ParticipantHistory = {
  identity: string; role: TelemetryRole; name: string;
  sessions: number; repeatSessions: number; reconnects: number;
  firstSeen: number; lastSeen: number;
};

/** One room and selection only. Names are labels, never participant identifiers.
 * Reconnect counters are cumulative since each session started; extra sessions
 * can be reloads, manual entries or simultaneous tabs, not necessarily outages.
 */
export function summarizeParticipants(connections: ConnectionHistory[]): ParticipantHistory[] {
  const groups = new Map<string, { participant: ParticipantHistory; sessions: Map<string, number> }>();
  for (const connection of connections) {
    const key = JSON.stringify([connection.role, connection.identity]);
    let group = groups.get(key);
    if (!group) {
      group = { participant: { identity: connection.identity, role: connection.role, name: connection.name,
        sessions: 0, repeatSessions: 0, reconnects: 0, firstSeen: connection.firstSeen, lastSeen: connection.lastSeen }, sessions: new Map() };
      groups.set(key, group);
    }
    const { participant, sessions } = group;
    const count = connection.latest.reconnects;
    sessions.set(connection.session, Math.max(sessions.get(connection.session) ?? 0, Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0));
    participant.firstSeen = Math.min(participant.firstSeen, connection.firstSeen);
    if (connection.lastSeen >= participant.lastSeen) {
      participant.lastSeen = connection.lastSeen;
      participant.name = connection.name;
    }
  }
  return [...groups.values()].map(({ participant, sessions }) => ({ ...participant,
    sessions: sessions.size, repeatSessions: Math.max(0, sessions.size - 1), reconnects: [...sessions.values()].reduce((sum, count) => sum + count, 0) }));
}
