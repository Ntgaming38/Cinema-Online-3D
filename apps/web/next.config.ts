import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // Botkeep Free gives the build only 512MB RAM: a default parallel
  // `next build` spawns one worker per host CPU and the worker gets
  // SIGKILLed mid-build (observed live 2026-11-05). One build worker,
  // and no separate type-check/lint passes during the deploy build —
  // types are verified in local builds before code reaches main.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: { cpus: 1 },
};
export default nextConfig;
