"use client";

import { Suspense } from "react";
import { HomeLobby } from "@/components/HomeLobby";

export default function HomePage() {
  return <Suspense fallback={<main><div className="panel">Загрузка…</div></main>}><HomeLobby /></Suspense>;
}
