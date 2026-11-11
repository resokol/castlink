import type {ServerPeer} from './server-profile-store.mjs';
import type {requestServerPeer} from './server-peer-request.mjs';
export type RecoveredProfile=Pick<ServerPeer,'id'|'label'|'origin'|'installationId'>;
export function recoverServerConnection(code:string,options?:{env?:NodeJS.ProcessEnv;requestPeer?:typeof requestServerPeer;replacePeer?:(peer:ServerPeer,expectedBinding:string|null,env?:NodeJS.ProcessEnv)=>Promise<unknown>}):Promise<{ok:true;profile:RecoveredProfile}>;
export function issueServerRecoveryCode(peerId:string,env?:NodeJS.ProcessEnv):Promise<{ok:true;code:string;expiresAt:number|string}>;
