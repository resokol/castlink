export type ServerEventLevel = "info" | "warn" | "error";
export type ServerEventFields = Record<string, string | number | boolean>;
export type PendingServerEvent = { at: number; level: ServerEventLevel; event: string; service: string; fields: ServerEventFields };
export type ServerEvent = PendingServerEvent & { id: number };
export type ObservabilityStorage = { state: "ok" | "unavailable"; droppedEvents: number; samplerRunning: boolean; corruptRecords?: number };
export type ServerEventsSnapshot = { generatedAt: number; retentionMs: number; events: ServerEvent[]; nextCursor: number | null; storage: ObservabilityStorage };
export type ServerEventRecord = ServerEvent;
export type ServerEventSnapshot = ServerEventsSnapshot;
