import {CliError, type NetworkMode} from './types.js';

export type BundleNetwork = {bindIPv4:string;origin:string;httpsPort:443;iceTcpPort:7881;iceUdpRange:'61000-61100'};
// These are candidate port mappings, not a discovery of interfaces or viable ICE candidates.
export function validateBundleNetwork(mode:NetworkMode,bindIPv4:string):BundleNetwork {
 if(mode!=='loopback' && mode!=='lan')throw new CliError('Unsupported bundle network mode; internet and TURN require separate validation.');
 if(typeof bindIPv4!=='string' || !/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(bindIPv4))throw new CliError('An explicit canonical IPv4 bind address is required.');
 const octets=bindIPv4.split('.').map(Number);
 if(octets.some(n=>n>255))throw new CliError('Invalid IPv4 bind address.');
 if(mode==='loopback' && bindIPv4!=='127.0.0.1')throw new CliError('Loopback requires the explicit 127.0.0.1 bind address.');
 const [a,b]=octets;
 if(mode==='lan' && !(a===10 || a===172 && b!==undefined && b>=16 && b<=31 || a===192 && b===168))throw new CliError('LAN requires an explicit private unicast IPv4 bind address.');
 return {bindIPv4,origin:`https://${bindIPv4}`,httpsPort:443,iceTcpPort:7881,iceUdpRange:'61000-61100'};
}
