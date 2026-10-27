/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    domains: ['images.unsplash.com', 'localhost', 'api.qrserver.com']
  },
  experimental: {
    optimizePackageImports: ['lucide-react']
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Use in-memory caching in development on Windows to eliminate PackFileCacheStrategy
      // ENOENT / file-lock collisions on vendor-chunks and avoid 404 chunk desync
      config.cache = {
        type: 'memory'
      };
    }
    return config;
  }
};

module.exports = nextConfig;
