import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer pulls in Node-native deps (fontkit, etc.) that must not be bundled
  // through webpack/turbopack — keep them external so the report API route renders server-side.
  serverExternalPackages: ["@react-pdf/renderer"],

  // The PDF route reads the IBM Plex fonts from public/fonts at runtime via @react-pdf/renderer.
  // @vercel/nft can't follow those fs reads (the package is external), so on Vercel the .ttf files
  // are missing from the serverless function and rendering 500s. Trace them in explicitly.
  // (Docker is unaffected — its runner image copies public/ wholesale.)
  outputFileTracingIncludes: {
    "/api/report/generate": ["./public/fonts/**"],
  },

  // Allow the dev server to serve /_next/* resources to tunneled origins (ngrok).
  // Without this, Next.js 16 blocks the JS chunks cross-origin and the page never
  // hydrates — inputs/buttons appear dead. Wildcard covers ngrok's rotating URLs.
  allowedDevOrigins: [
    "elevator-animate-both.ngrok-free.dev",
    "*.ngrok-free.dev",
    "*.ngrok-free.app",
    "*.ngrok.io",
  ],
};

export default nextConfig;
