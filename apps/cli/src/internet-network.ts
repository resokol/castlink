import {CliError} from './types.js';

// Operator declarations only: DNS ownership, routability, public TLS and TURN
// certificate provisioning/rotation are not established by these strings.
export type InternetConfiguration={domain:string;publicIPv4:string;turnDomain?:string};
export const internetTurnTlsDiagnosis='TURN TLS is unverified: protected TURN certificate/key provisioning and certificate rotation are not implemented. Do not start or mark the selected TURN mode ready; use direct Internet mode without a TURN domain until its guarded TLS stage is available.';
function fail():never{throw new CliError('Unsupported Internet declaration: requires canonical domain, explicit public-unicast IPv4 and optional distinct TURN domain.',2);}
function hostname(value:unknown):value is string{
 return typeof value==='string'&&value.length<=253&&value===value.toLowerCase()&&value.split('.').length>=2&&value.split('.').every(part=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part))&&/\.[a-z]{2,63}$/.test(value)&&!/(?:^|\.)(?:localhost|local|internal|invalid|test|example)$/.test(value);
}
export function ipv4Octets(value:unknown):number[]{
 if(typeof value!=='string'||!/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(value))fail();
 const octets=value.split('.').map(Number);if(octets.some(n=>n>255))fail();return octets;
}
export function validateInternetConfiguration(value:unknown):Readonly<InternetConfiguration>{
 if(!value||typeof value!=='object'||Array.isArray(value)||!['domain,publicIPv4','domain,publicIPv4,turnDomain'].includes(Object.keys(value).sort().join(',')))fail();
 const v=value as InternetConfiguration;if(!hostname(v.domain)||Object.hasOwn(v,'turnDomain')&&(!hostname(v.turnDomain)||v.domain===v.turnDomain))fail();
 const [a,b,c]=ipv4Octets(v.publicIPv4);
 if(a===undefined||b===undefined||c===undefined||a===0||a===10||a===127||a>=224||a===100&&b>=64&&b<=127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0&&c===0||b===0&&c===2)||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113)fail();
 return Object.freeze({domain:v.domain,publicIPv4:v.publicIPv4,...(Object.hasOwn(v,'turnDomain')?{turnDomain:v.turnDomain}:{})});
}
