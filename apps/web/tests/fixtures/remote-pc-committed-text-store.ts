import type { RemotePcView } from '@/lib/remote-pc-client';
import type { RemotePcController, RemotePcInputFrame } from '@/lib/remote-pc-protocol';
export type CommittedTextQa = {
  view: RemotePcView;
  credential: RemotePcController;
  sequences: {move:number;reliable:number};
  packets: RemotePcInputFrame[];
  trace: Record<string,unknown>[];
  delayed: boolean;
  holdSign: boolean;
  pending: boolean;
  signs: number;
  duplicateOnSign: boolean;
  duplicateAttempts: number;
  releaseSign?:()=>void;
};
declare global { interface Window { castlinkCommittedTextQa: CommittedTextQa; } }
export const useRemotePc=()=>window.castlinkCommittedTextQa.view;
export const remotePcSnapshot=()=>window.castlinkCommittedTextQa.view;
export const remotePcCredential=()=>{const credential=window.castlinkCommittedTextQa.credential;return credential.expiresAt>Date.now()?credential:undefined;};
export const remotePcServerTime=()=>Date.now();
export const remotePcInputSequences=()=>window.castlinkCommittedTextQa.sequences;
export const remotePcRequest=async()=>({});
