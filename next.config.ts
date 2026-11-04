import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep Node WebSocket/native optional dependencies out of the browser bundler.
  serverExternalPackages: ['msedge-tts'],
};

export default nextConfig;
