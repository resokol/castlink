'use client';
import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { PRESENTATION_AUTO_ACCEPT_KEY, presentationAutoAcceptPreference } from '@/lib/co-presentation-acceptance';
import { createPresentationNavigationFocus } from '@/lib/co-presentation-navigation';
export type PresentationScreenNavigation = {
  id: string; ownerIdentity: string; ownerSid: string; trackSid: string; ready: boolean;
  navigate: (direction: 'next' | 'previous') => void;
};
export type OwnerFloatingSurface = { ownerSid: string; trackSid: string; track: unknown };
export function ownerSurfaceMatches(surface: OwnerFloatingSurface | undefined, ownerSid: string, screen?: {trackSid: string; track?: {mediaStreamTrack: {readyState: string}}; isMuted?: boolean}) {
  return !!surface && surface.ownerSid === ownerSid && !!screen?.track && !screen.isMuted && screen.track.mediaStreamTrack.readyState === 'live' && surface.trackSid === screen.trackSid && surface.track === screen.track;
}
const NavigationContext = createContext<{ ownerSurface?: OwnerFloatingSurface; publishOwnerSurface?: (surface: OwnerFloatingSurface | undefined) => void; autoAccept: boolean; preferencesReady: boolean; setAutoAccept: (value: boolean) => void; grants: PresentationScreenNavigation[]; publish: (grants: PresentationScreenNavigation[]) => void } | undefined>(undefined);
export function CoPresentationNavigationProvider({ children }: { children: ReactNode }) {
  const [ownerSurface,publishOwnerSurface] = useState<OwnerFloatingSurface>();
  const [grants, publish] = useState<PresentationScreenNavigation[]>([]);
  const [autoAccept, setPreference] = useState(true), [preferencesReady, setPreferencesReady] = useState(false);
  useEffect(() => {
    try { setPreference(presentationAutoAcceptPreference(localStorage.getItem(PRESENTATION_AUTO_ACCEPT_KEY))); } catch { /* Default on if local storage is unavailable. */ }
    setPreferencesReady(true);
  },[]);
  const setAutoAccept = (value: boolean) => { setPreference(value); try { localStorage.setItem(PRESENTATION_AUTO_ACCEPT_KEY,String(value)); } catch { /* Keep this window preference. */ } };
  return <NavigationContext.Provider value={{ ownerSurface,publishOwnerSurface,grants, publish, autoAccept, preferencesReady, setAutoAccept }}>{children}</NavigationContext.Provider>;
}
export const useCoPresentationNavigation = () => useContext(NavigationContext);

export function usePresentationNavigationButtonFocus(grant: string, disabled: boolean) {
  const focus = useRef<ReturnType<typeof createPresentationNavigationFocus> | undefined>(undefined);
  useEffect(() => {
    const owned = createPresentationNavigationFocus(document); focus.current = owned;
    return () => { owned.dispose(); if (focus.current === owned) focus.current = undefined; };
  },[]);
  useEffect(() => { focus.current?.update(grant,disabled); });
  return (event: React.FocusEvent<HTMLButtonElement>) => { focus.current?.remember(event.currentTarget); };
}
