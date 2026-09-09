import type { NextConfig } from 'next';

const githubPages = process.env.GITHUB_PAGES === 'true';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/NextChapter';

const nextConfig: NextConfig = {
  agentRules: false,
  output: githubPages ? 'export' : undefined,
  basePath: githubPages ? basePath : undefined,
  assetPrefix: githubPages ? basePath : undefined,
  trailingSlash: githubPages,
  images: {
    unoptimized: githubPages,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'covers.openlibrary.org',
      },
    ],
  },
};

export default nextConfig;
