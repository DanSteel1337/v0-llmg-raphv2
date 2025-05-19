/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@supabase/supabase-js"],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark fs and path as external to prevent bundling
      config.externals.push("fs", "path", "crypto", "stream", "os")
    }
    return config
  },
}

module.exports = nextConfig
