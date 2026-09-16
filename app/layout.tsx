import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';

import { ServiceWorkerRegistration } from '@/components/service-worker-registration';

import './globals.css';

// Fraunces is a soft serif for the display voice; Nunito's rounded terminals
// keep small UI text gentle. Shared with Movie Companion so the two apps read as
// one family.
//
// Vendored rather than pulled from next/font/google: that fetches at build time
// and fails the production build outright when Google is unreachable, which
// would break a deploy for reasons unrelated to the change. Refresh the files
// with `node scripts/fetch-fonts.mjs`.
const display = localFont({
  src: '../public/fonts/fraunces-latin.woff2',
  weight: '300 700',
  display: 'swap',
  variable: '--font-display',
  fallback: ['Iowan Old Style', 'Baskerville', 'Times New Roman', 'serif'],
});

const body = localFont({
  src: '../public/fonts/nunito-latin.woff2',
  weight: '300 700',
  display: 'swap',
  variable: '--font-body',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
});

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const metadata: Metadata = {
  title: 'Next Chapter',
  description: 'Three personal picks from your Goodreads to-read shelf.',
  applicationName: 'Next Chapter',
  manifest: `${basePath}/manifest.webmanifest`,
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
    apple: `${basePath}/apple-touch-icon.png`,
  },
  openGraph: {
    type: 'website',
    title: 'Next Chapter',
    description: 'A thoughtful way to choose your next read.',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Next Chapter',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2fbf9' },
    { media: '(prefers-color-scheme: dark)', color: '#050f10' },
  ],
};

const themeScript = `
  try {
    const saved = localStorage.getItem('next-chapter-theme');
    const theme = saved === 'light' || saved === 'dark'
      ? saved
      : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (_) {
    document.documentElement.classList.add('dark');
  }
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
