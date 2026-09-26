import type { NextConfig } from "next";
import { randomUUID } from "node:crypto";

const release = process.env.STUDIOLINK_RELEASE || randomUUID();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  generateBuildId: async () => release,
  env: { NEXT_PUBLIC_APP_VERSION: release },
};

export default nextConfig;
