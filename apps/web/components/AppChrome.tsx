"use client";

import { createContext, Suspense, useContext, useState, type ReactNode } from "react";
import { AppUpdateNotice } from "./AppUpdateNotice";

const FooterSlotContext = createContext<(element: HTMLDivElement | null) => void>(() => undefined);

/** One version poller per page; only the footer moves, never the media tree. */
export function AppChrome({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return <FooterSlotContext.Provider value={setContainer}>
    {children}
    <Suspense fallback={null}><AppUpdateNotice container={container} /></Suspense>
  </FooterSlotContext.Provider>;
}

export function AppFooterSlot() {
  const setContainer = useContext(FooterSlotContext);
  return <div className="workspace-footer-slot" ref={setContainer} />;
}
