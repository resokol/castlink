import type { NextConfig } from "next";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const rootPackage = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version?: string };
const productVersion = String(rootPackage.version || "").trim();
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(productVersion)) {
  throw new Error("Root package.json must contain a valid semantic version");
}

const buildId = process.env.STUDIOLINK_RELEASE || `${productVersion}-dev-${randomUUID()}`;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  generateBuildId: async () => buildId,
  env: {
    NEXT_PUBLIC_APP_VERSION: buildId,
    NEXT_PUBLIC_BUILD_ID: buildId,
    NEXT_PUBLIC_PRODUCT_VERSION: productVersion,
  },
};

export default nextConfig;
