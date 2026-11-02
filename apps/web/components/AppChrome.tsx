"use client";

import { createContext, Suspense, useContext, useEffect, useState, type ReactNode } from "react";
import { installBrowserErrorListeners } from "../lib/browser-errors";
import { AppUpdateNotice } from "./AppUpdateNotice";
import { I18nProvider } from "./I18nProvider";
import { DesignPreview } from "./DesignPreview";

const FooterSlotContext = createContext<(element: HTMLDivElement | null) => void>(() => undefined);

/** One version poller per page; only the footer moves, never the media tree. */
export function AppChrome({ children }: { children: ReactNode }) {
  useEffect(() => installBrowserErrorListeners(window), []);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    try { document.documentElement.dataset.theme = window.localStorage.getItem("studiolink-theme") === "light" ? "light" : "dark"; }
    catch { /* Restricted storage keeps the existing document theme. */ }
  }, []);
  return <I18nProvider><FooterSlotContext.Provider value={setContainer}>
    <DesignPreview />
    {children}
    <Suspense fallback={null}><AppUpdateNotice container={container} /></Suspense>
  </FooterSlotContext.Provider></I18nProvider>;
}

export function AppFooterSlot({entry=false}: {entry?:boolean} = {}) {
  const setContainer = useContext(FooterSlotContext);
  return <div className="workspace-footer-slot" data-entry-footer={entry ? "true" : undefined} ref={setContainer} />;
}
