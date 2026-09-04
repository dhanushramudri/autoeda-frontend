/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  // Required for the Docker build (Dockerfile copies .next/standalone) —
  // Vercel ignores this setting and deploys via its own format regardless,
  // so this is safe alongside the existing Vercel deployment.
  output: 'standalone',
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname);
    return config;
  },
};

module.exports = nextConfig;