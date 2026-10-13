import type {ReserveCohort} from './server-reserve';
export const OUTBOUND_RESERVE_PROTOCOL='outbound-heartbeat-v1';
export const HEARTBEAT_INTERVAL_MS=5000;
export const HEARTBEAT_FAILURE_MS=20000;
/** Process-local monotonic evidence: a receiver restart never inherits a stale healthy lease. */
export class ReserveHeartbeatHistory {
 private rows=new Map<string,{healthyAt:number;lastAt:number;unhealthyAt?:number;committing?:boolean}>();
 private nonces=new Map<string,number>();
 constructor(private clock:()=>number=()=>performance.now()){}
 receive(binding:string,healthy:boolean,nonce:string){if(this.rows.get(binding)?.committing)throw Object.assign(new Error("Перенос уже фиксируется"),{status:409});const now=this.clock();for(const [key,at]of this.nonces)if(now-at>120000)this.nonces.delete(key);if(this.nonces.has(nonce))throw Object.assign(new Error('Повторный запрос'),{status:409});this.nonces.set(nonce,now);const row=this.rows.get(binding);if(healthy)this.rows.set(binding,{healthyAt:now,lastAt:now});else if(row){row.lastAt=now;row.unhealthyAt??=now;}for(const[key,value]of this.rows)if(!value.committing&&now-value.lastAt>600000)this.rows.delete(key);}
 claimCommit(binding:string){if(!this.confirmed(binding))throw Object.assign(new Error("Подтверждение отказа устарело"),{status:409});this.rows.get(binding)!.committing=true;}
 releaseFailedCommit(binding:string){if(!this.rows.get(binding)?.committing)return false;this.rows.delete(binding);return true;}
 ready(binding:string){return this.rows.has(binding);}
 confirmed(binding:string){const row=this.rows.get(binding),now=this.clock();return !!row&&now>=row.lastAt&&(now-row.lastAt>=HEARTBEAT_FAILURE_MS||row.unhealthyAt!==undefined&&now-row.unhealthyAt>=HEARTBEAT_FAILURE_MS);}
}
export function reserveHeartbeatHistory(){const key=Symbol.for('castlink.reserve-heartbeat-history');const shared=globalThis as typeof globalThis&{[key:symbol]:ReserveHeartbeatHistory|undefined};return shared[key] ||=new ReserveHeartbeatHistory();}
export function heartbeatBinding(path:string,c:ReserveCohort){return JSON.stringify([path,c.peerId,c.peerSecretVersion,c.sourceOrigin,c.sourceInstallationId,c.studioId,c.roomId,c.cohortId,c.armGeneration,c.autoEpoch||0]);}
