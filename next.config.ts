import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep verification builds separate from the running development server.
  distDir: process.env.AI_COACH_BUILD_DIR || '.next',
  // Keep Node WebSocket/native optional dependencies out of the browser bundler.
  serverExternalPackages: ['msedge-tts'],
};

export default nextConfig;
