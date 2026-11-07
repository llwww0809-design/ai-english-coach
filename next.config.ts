import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  // Keep verification builds separate from the running development server.
  distDir: process.env.AI_COACH_BUILD_DIR || '.next',
};

export default nextConfig;
