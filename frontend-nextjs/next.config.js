/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['p16-sign-va.tiktokcdn.com', 'p16-sign.tiktokcdn-us.com', 'p77-sign.tiktokcdn-us.com'],
  },
}

module.exports = nextConfig
