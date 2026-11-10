"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Only action buttons move; media, file input and active controllers stay put. */
export const CasterToolbarSlots = createContext<{ upload: HTMLElement | null; cameraEffects: HTMLElement | null }>({ upload: null, cameraEffects: null });
export function CasterToolbarAction({ slot, children }: { slot: "upload" | "cameraEffects"; children: ReactNode }) {
  const target = useContext(CasterToolbarSlots)[slot];
  return target ? createPortal(children, target) : children;
}
