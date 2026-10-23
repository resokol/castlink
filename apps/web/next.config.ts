import type { NextConfig } from "next";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rootPackage = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version?: string; buildNumber?: string };
// Release builders select a product track without mutating the source tree.
// Ordinary web/development builds retain the root package identity.
const productVersion = String(process.env.CASTLINK_PRODUCT_VERSION || rootPackage.version || "").trim();
const productBuildNumber = process.env.CASTLINK_PRODUCT_BUILD_NUMBER || rootPackage.buildNumber || "";
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(productVersion)) {
  throw new Error("The selected product must contain a valid semantic version");
}

const buildId = process.env.STUDIOLINK_RELEASE || `${productVersion}-dev-${randomUUID()}`;

const securityHeaders = [
  { key: "Content-Security-Policy", value: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-src 'self' castlink: castlink-presenter: castlink-remote: castlink-share:; frame-ancestors 'self'; form-action 'self'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' https: wss: http: ws:; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), display-capture=(self), fullscreen=(self), autoplay=(self), speaker-selection=(self)" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  serverExternalPackages: ["pg", "ssh2"],
  // Presentation upload bypasses middleware body cloning and enforces its own streamed limit.
  // Keep ordinary API cloning bounded; never buffer the 1.5 GB presentation path here.
  experimental: { middlewareClientMaxBodySize: 26 * 1024 * 1024 },
  outputFileTracingExcludes: { "/*": [".studiolink-data/**/*", ".env*"] },
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  generateBuildId: async () => buildId,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: buildId,
    NEXT_PUBLIC_BUILD_ID: buildId,
    NEXT_PUBLIC_PRODUCT_VERSION: productVersion,
    NEXT_PUBLIC_BUILD_NUMBER: productBuildNumber,
  },
};

export default nextConfig;

