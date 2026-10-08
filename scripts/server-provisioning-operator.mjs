// Trusted Docker-exec operator only; no HTTP installation-profile write route.
import {createRequire} from 'node:module';
import {makeSshTools} from './server-provisioning-ssh.mjs';
import {makeProvisioning} from './server-provisioning.mjs';
import {requestServerPeer} from './server-peer-request.mjs';
import {registerPeerViaOperator} from './server-profile-store.mjs';
const require=createRequire(new URL('../apps/web/package.json',import.meta.url));
const {Client}=require('ssh2');
const ssh=makeSshTools(Client),provisioning=makeProvisioning({...ssh,requestServerPeer});
async function main(){
 let text='';for await(const chunk of process.stdin){text+=chunk;if(text.length>8192)throw Error('Invalid operator input');}
 const data=JSON.parse(text);text='';
 if(data.action==='fingerprint'){
  const {validateProvisioningHost}=await import('./server-profile-store.mjs');
  const host=validateProvisioningHost(data.host);if(!Number.isInteger(data.port)||data.port<1||data.port>65535)throw Error('Invalid SSH port');
  console.log(JSON.stringify({fingerprint:await ssh.probeSshFingerprint({host,port:data.port})}));return;
 }
 if(data.action!=='provision')throw Error('Invalid operator action');
 const peer=await provisioning.provisionServer(data.input,{scope:{kind:'installation'},assertAuthorized:async()=>{},persistPeer:registerPeerViaOperator,onProgress:value=>console.log(JSON.stringify({progress:value}))});
 data.input.password='';console.log(JSON.stringify({ok:true,profile:{id:peer.id,label:peer.label,origin:peer.origin,installationId:peer.installationId}}));
}
void main().catch(()=>{console.error('Server provisioning failed. Verify root SSH, Ubuntu, free ports and HTTPS; existing data was preserved.');process.exitCode=1;});
