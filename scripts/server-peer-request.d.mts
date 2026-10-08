import type {ServerPeer} from './server-profile-store.mjs';
export function requestServerPeer(peer:ServerPeer,pathname:string,options?:{method?:string;body?:string;headers?:Record<string,string>;timeoutMs?:number}):Promise<Response>;
