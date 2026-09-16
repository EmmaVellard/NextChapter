import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const appRoot = `${basePath}/`;

  return {
    name: 'Next Chapter',
    short_name: 'Next Chapter',
    description: 'Three personal picks from your Goodreads to-read shelf.',
    start_url: appRoot,
    scope: appRoot,
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#050f10',
    theme_color: '#050f10',
    categories: ['books', 'lifestyle'],
    icons: [
      {
        src: `${basePath}/icon-192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${basePath}/icon-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${basePath}/icon-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
