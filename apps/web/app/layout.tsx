import "@livekit/components-styles";
import "./globals.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AppUpdateNotice } from "@/components/AppUpdateNotice";

// A newly opened studio must receive current HTML and its matching asset hashes.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "StudioLink",
  description: "Low-latency remote guest platform for live production",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}<Suspense fallback={null}><AppUpdateNotice /></Suspense></body>
    </html>
  );
}
