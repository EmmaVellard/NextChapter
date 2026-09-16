const CACHE_NAME = 'next-chapter-shell-v4';
const APP_ROOT = new URL('./', self.registration.scope).href;
const IMMUTABLE_PREFIX = new URL('_next/static/', APP_ROOT).pathname;
const APP_SHELL = [
  APP_ROOT,
  new URL('favicon.svg', APP_ROOT).href,
  new URL('apple-touch-icon.png', APP_ROOT).href,
  new URL('icon-192.png', APP_ROOT).href,
  new URL('icon-512.png', APP_ROOT).href,
];

const OFFLINE_FALLBACK = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Next Chapter is offline</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#101a1c;color:#f2f6f5;font:16px/1.5 -apple-system,system-ui,sans-serif;padding:24px;text-align:center}</style>
</head><body><div><h1>You are offline</h1>
<p>Next Chapter could not load. Reconnect and try again &mdash; your library is still saved on this device.</p></div></body></html>`;

function offlineResponse() {
  return new Response(OFFLINE_FALLBACK, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// Only a real, same-origin, non-redirected success may enter the cache. Caching
// a 404 or 5xx here would make an error page the permanent offline app shell.
function isCacheable(response) {
  return Boolean(
    response && response.ok && response.type === 'basic' && !response.redirected,
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Per-item so one missing asset cannot fail the whole installation and
      // silently leave the app with no offline support at all.
      await Promise.allSettled(
        APP_SHELL.map(async (url) => {
          const response = await fetch(url, { cache: 'reload' });
          if (!isCacheable(response)) return;
          await cache.put(url, response);
        }),
      );
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                (key.startsWith('next-chapter-shell-') ||
                  key.startsWith('book-companion-shell-')) &&
                key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheable(response)) {
            const copy = response.clone();
            void caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(APP_ROOT, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(APP_ROOT)) ?? offlineResponse()),
    );
    return;
  }

  // Hashed build output is immutable, so serving it from cache can never mix
  // builds. Everything else keeps a stable URL across deploys, so a cached copy
  // would pin one build's assets forever and eventually mismatch the shell.
  if (url.pathname.startsWith(IMMUTABLE_PREFIX)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (isCacheable(response)) {
              const copy = response.clone();
              void caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (isCacheable(response)) {
          const copy = response.clone();
          void caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw new Error(`Offline and no cached response for ${url.pathname}`);
      }),
  );
});
