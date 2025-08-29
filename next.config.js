/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config, { isServer }) => {
    // Exclude tiktoken from server-side bundling to prevent WASM issues in Vercel
    if (isServer) {
      config.externals = [...(config.externals || []), 'tiktoken']
    }
    
    return config
  },
}

module.exports = nextConfig