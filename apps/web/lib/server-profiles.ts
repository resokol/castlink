// Server-only facade. Never return ServerPeer secrets in a browser response.
export {serverProfileIdentity,listRoomServerProfiles,getServerPeer,getIncomingServerPeer,putServerPeer,removeRoomServerPeer,validateProvisioningHost,exactHttpsOrigin,requireUuid} from '../../../scripts/server-profile-store.mjs';
export type {ServerPeer,ServerScope,ServerProfileIdentity} from '../../../scripts/server-profile-store.mjs';
