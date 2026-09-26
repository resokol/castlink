"use client";
import { useEffect, useState } from "react";

export function useRoomMode(roomName: string) {
  const [studioOnly, setStudioOnly] = useState(true);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    setStudioOnly(true);
    const poll = async () => {
      try {
        const response = await fetch(`/api/rooms?name=${encodeURIComponent(roomName)}`, { cache: "no-store", signal: controller.signal });
        if (response.ok) { const data = await response.json(); if (!stopped) setStudioOnly(data.studioOnly === true); }
      } catch { /* Keep the last confirmed mode during a network interruption. */ }
      if (!stopped) timer = setTimeout(poll, 1000);
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); controller.abort(); };
  }, [roomName]);
  return { studioOnly, setStudioOnly };
}
