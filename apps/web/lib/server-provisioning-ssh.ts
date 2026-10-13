import {Client,utils} from 'ssh2';
export type {Client as ServerProvisioningSshClient} from 'ssh2';
import {makeSshTools} from '../../../scripts/server-provisioning-ssh.mjs';
const ssh=makeSshTools(Client,utils.parseKey);
export const {probeSshFingerprint,openVerifiedSsh,executeFixedSsh,generateSshKeyPair,validateSshKeyPair}=ssh;
