/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Add webpack configuration to handle Node.js modules
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve 'fs', 'path', etc. on the client to prevent errors
      config.resolve.fallback = {
        fs: false,
        path: false,
        stream: false,
        crypto: false,
        os: false,
        http: false,
        https: false,
        zlib: false,
        net: false,
        tls: false,
        child_process: false,
        "node:stream": false,
        "node:util": false,
        "node:url": false,
        "node:http": false,
        "node:https": false,
        "node:zlib": false,
        "node:buffer": false,
      }
    }

    // Explicitly mark these packages as external for server-side
    if (isServer) {
      config.externals = [...(config.externals || []), "fs", "path", "stream", "node:stream"]
    }

    return config
  },
  // Explicitly tell Next.js which packages are server-only
  experimental: {
    serverComponentsExternalPackages: ["@pinecone-database/pinecone", "fs", "path", "stream", "node:stream"],
  },
}

module.exports = nextConfig
