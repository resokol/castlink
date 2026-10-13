import {CliError, type NetworkMode} from './types.js';
import {validateInternetConfiguration,type InternetConfiguration} from './internet-network.js';

export type BundleNetwork = {bindIPv4:string;origin:string;httpsPort:443;iceTcpPort:7881;iceUdpRange:'61000-61100';internet?:Readonly<InternetConfiguration>;advertisedIPv4?:string};
// These are candidate port mappings, not a discovery of interfaces or viable ICE candidates.
export function validateBundleNetwork(mode:NetworkMode,bindIPv4:string,internet?:InternetConfiguration):BundleNetwork {
 if(mode!=='loopback' && mode!=='lan'&&mode!=='internet')throw new CliError('Unsupported bundle network mode.');
 if(mode!=='internet'&&internet!==undefined)throw new CliError('Internet fields are forbidden for loopback/LAN.',2);
 if(typeof bindIPv4!=='string' || !/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(bindIPv4))throw new CliError('An explicit canonical IPv4 bind address is required.');
 const octets=bindIPv4.split('.').map(Number);
 if(octets.some(n=>n>255))throw new CliError('Invalid IPv4 bind address.');
 if(mode==='loopback' && bindIPv4!=='127.0.0.1')throw new CliError('Loopback requires the explicit 127.0.0.1 bind address.');
 const [a,b]=octets;
 if(mode==='internet'){
  const selected=validateInternetConfiguration(internet);
  if(a===undefined||b===undefined||a===0||a===127||a>=224||a===169&&b===254)throw new CliError('Internet requires an explicit unicast target interface bind; wildcard, loopback and link-local are forbidden.',2);
  return {bindIPv4,origin:`https://${selected.domain}`,httpsPort:443,iceTcpPort:7881,iceUdpRange:'61000-61100',internet:selected,advertisedIPv4:selected.publicIPv4};
 }
 if(mode==='lan' && !(a===10 || a===172 && b!==undefined && b>=16 && b<=31 || a===192 && b===168))throw new CliError('LAN requires an explicit private unicast IPv4 bind address.');
 return {bindIPv4,origin:`https://${bindIPv4}`,httpsPort:443,iceTcpPort:7881,iceUdpRange:'61000-61100'};
}
