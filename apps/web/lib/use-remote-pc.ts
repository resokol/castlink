'use client';
import { useSyncExternalStore } from 'react';
import type { Room } from 'livekit-client';
import { remotePcSnapshot, subscribeRemotePc } from './remote-pc-client';
export function useRemotePc(room:Room){return useSyncExternalStore(listener=>subscribeRemotePc(room,listener),()=>remotePcSnapshot(room),()=>remotePcSnapshot(room));}
