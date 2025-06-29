/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: [
      'vibrant.productizetech.com',
      'vibrant-comic-ai.s3.amazonaws.com',
      'placeholder.svg'
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vibrant.productizetech.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'vibrant-comic-ai.s3.amazonaws.com',
        port: '',
        pathname: '/**',
      }
    ],
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  },
}

export default nextConfig
