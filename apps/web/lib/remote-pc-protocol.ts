/** Frozen v1 wire contract. Native HWND/PID and HTTP credentials never enter source mappings. */
export const REMOTE_PC_PURPOSE = 'remote-pc-v1' as const;
export const REMOTE_PC_ENDPOINT = '/api/remote-pc-control';
export const REMOTE_PC_RELIABLE_TOPIC = 'castlink.remote-pc.input.v1';
export const REMOTE_PC_MOVE_TOPIC = 'castlink.remote-pc.move.v1';
export const REMOTE_PC_LEASE_MS = 750;
export type RemotePcParticipant = {identity: string; sid: string};
export type RemotePcGeometry = {width: number; height: number; revision: number};
export type RemotePcInputStatus = {state: 'ready' | 'paused'; pointerReady?: boolean; reason?: 'SOURCE_UNAVAILABLE' | 'SOURCE_OCCLUDED' | 'SOURCE_MINIMIZED' | 'INPUT_DESKTOP_UNAVAILABLE' | 'GEOMETRY_CHANGED' | 'NATIVE_UNAVAILABLE'};
export type RemotePcSource = {
  sessionId: string; generation: string; studioId: string; room: string;
  owner: RemotePcParticipant; helper: RemotePcParticipant; captureId: string;
  sourceKind: 'screen' | 'window'; name: string; geometry: RemotePcGeometry;
  videoTrackSid: string; audioTrackSid?: string;
  inputStatus?: RemotePcInputStatus;
};
export type RemotePcGrantView = {id: string; revision: number; controller: RemotePcParticipant; phase: 'activating' | 'active' | 'revoking'};
export type RemotePcSession = {
  purpose: typeof REMOTE_PC_PURPOSE; id: string; generation: string; revision: number;
  owner: RemotePcParticipant; phase: 'pairing' | 'choosing' | 'sharing' | 'stopping' | 'stopped';
  source?: RemotePcSource; grant?: RemotePcGrantView;
  pending?: {action: 'revoke' | 'stop'; revision: number; expiresAt: number; grantId?: string};
  completedAt?: number;
};
export type RemotePcController = {
  grantId: string; revision: number; inputKey: string; helper: RemotePcParticipant;
  sessionId: string; generation: string; captureId: string; geometryRevision: number;
  expiresAt: number;
};
export type RemotePcNativeGrant = RemotePcController & {
  controller: RemotePcParticipant; activationNonce: string; expiresAt: number;
};
export type RemotePcLease = {
  requestId: string; requestSeq: number; leaseSerial: number; serverTime: number;
  validForMs: number; session: RemotePcSession; grant?: RemotePcNativeGrant;
};
export type RemotePcResponse = {
  serverTime: number; session?: RemotePcSession; sessions?: RemotePcSession[];
  sources?: RemotePcSource[]; controller?: RemotePcController;
  publisher?: {identity: string; token: string; url: string};
};
export type RemotePcBeginResponse = RemotePcResponse & {session: RemotePcSession; ticket: string; ticketExpiresAt: number};
export type RemotePcPairResponse = {
  nativeId: string; nativeToken: string; expiresAt: number;
  context: {purpose: typeof REMOTE_PC_PURPOSE; sessionId: string; generation: string; studioId: string; room: string; owner: RemotePcParticipant};
  publisher: {identity: string; token: string; url: string}; serverTime: number;
};
export type RemotePcBrowserRequest = {
  purpose: typeof REMOTE_PC_PURPOSE; studioId: string; room: string;
} & (
  {action: 'begin'} |
  {action: 'read'} |
  {action: 'controller'; sessionId: string; generation: string} |
  {action: 'delegate'; sessionId: string; generation: string; revision: number; controllerIdentity: string; controllerSid: string} |
  {action: 'revoke' | 'stop'; sessionId: string; generation: string; revision: number}
);
export type RemotePcNativeRequest = {purpose: typeof REMOTE_PC_PURPOSE} & (
  {action: 'pair'; ticket: string} |
  ({nativeId: string; sessionId: string; generation: string} & (
    {action: 'native-source'; captureId: string; sourceKind: 'screen' | 'window'; name: string; geometry: RemotePcGeometry; audio: boolean; inputStatus?: RemotePcInputStatus} |
    {action: 'native-published'; captureId: string; helperSid: string; videoTrackSid: string; audioTrackSid?: string} |
    {action: 'native-geometry'; captureId: string; geometry: RemotePcGeometry; inputStatus?: RemotePcInputStatus} |
    {action: 'native-lease'; requestId: string; requestSeq: number} |
    {action: 'native-activated'; grantId: string; revision: number; activationNonce: string; leaseSerial: number} |
    {action: 'native-revoked'; revision: number; leaseSerial: number} |
    {action: 'native-stop'; captureId?: string}
  ))
);
export type RemotePcInputEvent =
  {type: 'move'; x: number; y: number} |
  {type: 'button'; button: 0 | 1 | 2; down: boolean; x: number; y: number} |
  {type: 'wheel'; x: number; y: number; deltaX: number; deltaY: number} |
  {type: 'key'; code: string; down: boolean; repeat: boolean} |
  {type: 'text'; text: string} |
  {type: 'heartbeat'; pressedKeys: string[]; pressedButtons: (0 | 1 | 2)[]} |
  {type: 'releaseAll'};
export type RemotePcUnsignedInput = {
  v: 1; sessionId: string; generation: string; captureId: string; grantId: string;
  revision: number; geometryRevision: number; lane: 'reliable' | 'move';
  seq: number; expiresAt: number; moveBarrier: number; event: RemotePcInputEvent;
};
export type RemotePcInputFrame = RemotePcUnsignedInput & {mac: string};

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string, unknown>, fields: string[]) => Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value,key));
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const opaque = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(value);
const keyCode=(s:unknown)=>typeof s==='string'&&/^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-9]|2[0-4])|Numpad[0-9]|Numpad(Add|Subtract|Multiply|Divide|Decimal|Enter)|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Meta(Left|Right)|Arrow(Left|Right|Up|Down)|Enter|Tab|Space|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Escape|CapsLock|NumLock|ScrollLock|Pause|PrintScreen|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|IntlBackslash)$/.test(s);
const point = (value: Record<string, unknown>) => integer(value.x,0,65535) && integer(value.y,0,65535);
export function validRemotePcInput(value: unknown, signed = true): value is RemotePcInputFrame {
  if (!object(value) || !exact(value,['v','sessionId','generation','captureId','grantId','revision','geometryRevision','lane','seq','expiresAt','moveBarrier','event',...(signed ? ['mac'] : [])]) || value.v !== 1 || !['sessionId','generation','captureId','grantId'].every(key => opaque(value[key])) || !integer(value.revision,1) || !integer(value.geometryRevision,1) || !integer(value.seq,1) || !integer(value.expiresAt,1) || !integer(value.moveBarrier) || signed && (typeof value.mac !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value.mac)) || !object(value.event)) return false;
  const event = value.event;
  if (event.type === 'move') return value.lane === 'move' && exact(event,['type','x','y']) && point(event);
  if (value.lane !== 'reliable') return false;
  switch (event.type) {
    case 'button': return exact(event,['type','button','down','x','y']) && integer(event.button,0,2) && typeof event.down === 'boolean' && point(event);
    case 'wheel': return exact(event,['type','x','y','deltaX','deltaY']) && point(event) && integer(event.deltaX,-12000,12000) && integer(event.deltaY,-12000,12000);
    case 'key': return exact(event,['type','code','down','repeat']) && keyCode(event.code) && typeof event.down === 'boolean' && typeof event.repeat === 'boolean';
    case 'text': return exact(event,['type','text']) && typeof event.text === 'string' && event.text.length > 0 && event.text.length <= 256 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(event.text);
    case 'heartbeat': return exact(event,['type','pressedKeys','pressedButtons']) && Array.isArray(event.pressedKeys) && event.pressedKeys.length <= 32 && event.pressedKeys.every(keyCode) && new Set(event.pressedKeys).size === event.pressedKeys.length && Array.isArray(event.pressedButtons) && event.pressedButtons.length <= 3 && event.pressedButtons.every(button => integer(button,0,2)) && new Set(event.pressedButtons).size === event.pressedButtons.length;
    case 'releaseAll': return exact(event,['type']);
    default: return false;
  }
}
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (!object(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key,sorted(value[key])]));
}
/** UTF8 of recursively key-sorted JSON, unsigned frame only; arrays keep their order. */
export function remotePcInputMacPayload(value: RemotePcUnsignedInput) {
  if (!validRemotePcInput(value,false)) throw new Error('Invalid remote input');
  return JSON.stringify(sorted(value));
}
function inputKey(value: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) throw new Error('Invalid input key');
  return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='),character => character.charCodeAt(0));
}
export async function signRemotePcInput(value: RemotePcUnsignedInput, key: string): Promise<RemotePcInputFrame> {
  const payload = new TextEncoder().encode(remotePcInputMacPayload(value));
  const secret = await crypto.subtle.importKey('raw',inputKey(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC',secret,payload));
  return {...value,mac:btoa(String.fromCharCode(...mac)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
}
export async function verifyRemotePcInput(value: unknown, key: string) {
  if (!validRemotePcInput(value)) return false;
  const {mac,...unsigned} = value;
  try {
    const secret = await crypto.subtle.importKey('raw',inputKey(key),{name:'HMAC',hash:'SHA-256'},false,['verify']);
    return await crypto.subtle.verify('HMAC',secret,inputKey(mac),new TextEncoder().encode(remotePcInputMacPayload(unsigned)));
  } catch { return false; }
}
