export type GuestChoices = { audioDeviceId?: string; videoDeviceId?: string; audioOutputId?: string; audioEnabled?: boolean; videoEnabled?: boolean; height: 720 | 1080; micGain: number; listenGain: number };

type ParticipantData = { identity: string; metadata?: string };
export type GuestClientInfo = { camera: string; cpu: string; gpu: string; platform: string; sampleRate: number };

function metadataOf(raw?: string): Record<string, unknown> {
  try { const value = JSON.parse(raw || "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
  catch { return {}; }
}

/** Only send guest hardware details to the primary and admin control panels. */
export function guestClientInfoRecipients(participants: Iterable<ParticipantData>) {
  const identities: string[] = [];
  for (const participant of participants) {
    const metadata = metadataOf(participant.metadata);
    const primary = participant.identity === "studio-panel-main" && metadata.role === "studio-panel" && metadata.accessRole === "admin";
    const adminPanel = participant.identity.startsWith("studio-moderator-") && metadata.role === "studio-moderator" && (metadata.accessRole === "admin" || metadata.roomAdmin === true);
    if (primary || adminPanel) identities.push(participant.identity);
  }
  return identities;
}

/** Accept only the small, known guest telemetry payload; arbitrary objects never reach React. */
export function parseGuestClientInfo(payload: Uint8Array, identity: string, metadataRaw?: string): GuestClientInfo | null {
  if (!identity.startsWith("guest-") || metadataOf(metadataRaw).role !== "guest" || payload.byteLength > 2048) return null;
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(payload));
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const data = value as Record<string, unknown>;
    const textField = (key: string) => typeof data[key] === "string" && (data[key] as string).length <= 160 ? data[key] as string : null;
    const camera = textField("camera"), cpu = textField("cpu"), gpu = textField("gpu"), platform = textField("platform");
    if (data.type !== "guest-client-info" || camera === null || cpu === null || gpu === null || platform === null ||
      typeof data.sampleRate !== "number" || !Number.isSafeInteger(data.sampleRate) || data.sampleRate < 0 || data.sampleRate > 384_000) return null;
    return { camera, cpu, gpu, platform, sampleRate: data.sampleRate };
  } catch { return null; }
}

/** Find only authenticated output clients bound to the exact source participant. */
export function outputQualityRecipients(participants: Iterable<ParticipantData>, targetIdentity: string) {
  const identities: string[] = [];
  for (const participant of participants) {
    const metadata = metadataOf(participant.metadata);
    if (participant.identity.startsWith("output-") && metadata.role === "output" && metadata.outputTarget === targetIdentity) identities.push(participant.identity);
  }
  return identities;
}

export function guestCaptureConstraints(choices: GuestChoices): MediaStreamConstraints | null {
  const audio = choices.audioEnabled !== false;
  const video = choices.videoEnabled !== false;
  if (!audio && !video) return null;
  return {
    audio: audio ? (choices.audioDeviceId ? { deviceId: { exact: choices.audioDeviceId } } : true) : false,
    video: video ? ({ ...(choices.videoDeviceId ? { deviceId: { exact: choices.videoDeviceId } } : {}), height: { ideal: choices.height }, frameRate: { ideal: 30 }, resizeMode: { ideal: "none" } } as MediaTrackConstraints) : false,
  };
}
