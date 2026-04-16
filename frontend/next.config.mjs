/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["cesium"],
  experimental: {
    optimizePackageImports: ["cesium"]
  }
};

export default nextConfig;
