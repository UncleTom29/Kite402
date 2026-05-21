/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  output: 'standalone',
  images: {
    domains: ['testnet.kitescan.ai', 'kitescan.ai'],
  },
  async rewrites() {
    return [
      { source: '/fleet', destination: '/dashboard' },
      { source: '/approvals', destination: '/dashboard/approvals' },
      { source: '/governance', destination: '/dashboard/governance' },
      { source: '/audit', destination: '/dashboard/audit' },
      { source: '/agents/new', destination: '/dashboard/agents/new' },
      { source: '/agents/:agentId', destination: '/dashboard/agents/:agentId' },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
