import type { NextConfig } from 'next';

/**
 * HOLLOWMOOR is a fully client-side game: there is no server runtime beyond
 * static delivery, which makes the project deploy on Vercel with zero config.
 * Strict mode is disabled because the R3F scene manages imperative resources
 * (pointer lock, WebAudio, Rapier bodies) whose double-mount in dev strict
 * mode produces misleading noise; production behaviour is identical.
 */
const nextConfig: NextConfig = {
  reactStrictMode: false,
  eslint: {
    // Lint runs as its own quality gate (`npm run lint` / CI), not during builds.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
