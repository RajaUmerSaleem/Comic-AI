/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "https://54.91.239.105",
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['54.91.239.105', 'vibrant-comic-ai.s3.amazonaws.com'],
    unoptimized: true,
  },
}

export default nextConfig
