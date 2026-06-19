import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
