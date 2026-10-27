/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    domains: ['images.unsplash.com', 'localhost', 'api.qrserver.com']
  }
};

module.exports = nextConfig;
