import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compiler: {
    styledComponents: true,
  },
  transpilePackages: ['@primer/react', '@primer/octicons-react'],
  serverExternalPackages: ['@neondatabase/serverless'],
}

export default nextConfig
