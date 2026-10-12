"use client";

import { Suspense } from "react";
import { HomeLobby } from "@/components/HomeLobby";

export default function HomePage() {
  return <Suspense fallback={<main className="graphite-entry status-page"><div className="panel status-card" role="status">Загрузка…</div></main>}><HomeLobby /></Suspense>;
}
