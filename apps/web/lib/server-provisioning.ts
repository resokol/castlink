import {effectiveRoomCreationPasswordHash} from './room-creation-access';
import * as ssh from './server-provisioning-ssh';
import {requestServerPeer} from './server-peer-request';
import {makeProvisioning} from '../../../scripts/server-provisioning.mjs';
const provisioning=makeProvisioning({...ssh,requestServerPeer,getRoomCreationPasswordHash:effectiveRoomCreationPasswordHash});
export const {validateProvisioningInput,getServerProvisioningJob,withServerPeerRemoval,startServerProvisioning,startServerUpdate,currentProvisioningRelease,provisionServer,authorizeSshPublicKey}=provisioning;
export type {ProvisioningInput,ProvisioningJob} from '../../../scripts/server-provisioning.mjs';
