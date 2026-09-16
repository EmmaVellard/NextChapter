import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SCOPE = 'https://example.github.io/NextChapter/';
const APP_ROOT = SCOPE;

// The worker only reads method/url/mode, and the Fetch spec forbids building a
// real Request with mode 'navigate', so plain objects stand in for both sides.
function fakeRequest(url: string, mode = 'no-cors', method = 'GET') {
  return { url, mode, method };
}

function fakeResponse(status = 200, type = 'basic') {
  return {
    ok: status >= 200 && status < 300,
    status,
    type,
    redirected: false,
    clone() {
      return this;
    },
  };
}

class FakeCache {
  entries = new Map<string, unknown>();

  async put(request: { url: string } | string, response: unknown) {
    this.entries.set(
      typeof request === 'string' ? request : request.url,
      response,
    );
  }

  async match(request: { url: string } | string) {
    return this.entries.get(
      typeof request === 'string' ? request : request.url,
    );
  }
}

class FakeCacheStorage {
  caches = new Map<string, FakeCache>();

  async open(name: string) {
    const existing = this.caches.get(name);
    if (existing) return existing;
    const created = new FakeCache();
    this.caches.set(name, created);
    return created;
  }

  async keys() {
    return [...this.caches.keys()];
  }

  async delete(name: string) {
    return this.caches.delete(name);
  }

  async match(request: { url: string } | string) {
    for (const cache of this.caches.values()) {
      const hit = await cache.match(request);
      if (hit) return hit;
    }
    return undefined;
  }
}

function loadWorker(fetchMock: ReturnType<typeof vi.fn>) {
  const source = readFileSync(
    path.join(process.cwd(), 'public', 'sw.js'),
    'utf8',
  );
  const listeners = new Map<string, (event: unknown) => void>();
  const cacheStorage = new FakeCacheStorage();
  const self = {
    registration: { scope: SCOPE },
    location: { origin: 'https://example.github.io' },
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      listeners.set(type, handler);
    },
    skipWaiting: () => {},
    clients: { claim: async () => {} },
  };

  vm.runInNewContext(source, {
    self,
    caches: cacheStorage,
    fetch: fetchMock,
    Response,
    URL,
    Promise,
    Boolean,
  });

  // Explicit return type: the assignment happens inside a callback, so control
  // flow analysis would otherwise narrow the result to exactly `null`.
  function dispatchFetch(
    request: ReturnType<typeof fakeRequest>,
  ): Promise<unknown> | null {
    let responded: Promise<unknown> | null = null;
    listeners.get('fetch')!({
      request,
      respondWith: (value: Promise<unknown>) => {
        responded = value;
      },
    });
    return responded;
  }

  /** For requests the worker is expected to handle, so awaits stay typed. */
  function respond(request: ReturnType<typeof fakeRequest>): Promise<unknown> {
    const responded = dispatchFetch(request);
    if (responded === null) {
      throw new Error(`the worker did not handle ${request.url}`);
    }
    return responded;
  }

  return { dispatchFetch, respond, cacheStorage };
}

/** The worker deliberately does not await its cache writes. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('service worker fetch handling', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
  });

  it('never stores an error page as the offline app shell', async () => {
    // GitHub Pages answers unknown paths with a 404 document. Caching that as
    // the app shell made an installed PWA cold-start into "File not found"
    // with no way to recover from inside the app.
    fetchMock.mockResolvedValue(fakeResponse(404));
    const worker = loadWorker(fetchMock);

    await worker.respond(fakeRequest(`${SCOPE}missing/`, 'navigate'));
    await flush();

    expect(await worker.cacheStorage.match(APP_ROOT)).toBeUndefined();
  });

  it('does not store a server error as the offline app shell', async () => {
    fetchMock.mockResolvedValue(fakeResponse(500));
    const worker = loadWorker(fetchMock);

    await worker.respond(fakeRequest(SCOPE, 'navigate'));
    await flush();

    expect(await worker.cacheStorage.match(APP_ROOT)).toBeUndefined();
  });

  it('stores a successful navigation as the offline app shell', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200));
    const worker = loadWorker(fetchMock);

    await worker.respond(fakeRequest(SCOPE, 'navigate'));
    await flush();

    expect(await worker.cacheStorage.match(APP_ROOT)).toBeDefined();
  });

  it('answers with a real response when offline and nothing is cached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const worker = loadWorker(fetchMock);

    const response = (await worker.respond(
      fakeRequest(SCOPE, 'navigate'),
    )) as Response;

    // respondWith(undefined) throws and shows the browser's network error page.
    expect(response).toBeInstanceOf(Response);
    expect(await response.text()).toContain('offline');
  });

  it('serves hashed build output from cache without a second request', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200));
    const worker = loadWorker(fetchMock);
    const request = fakeRequest(`${SCOPE}_next/static/chunks/main-abc123.js`);

    await worker.respond(request);
    await flush();
    const afterFirst = fetchMock.mock.calls.length;
    await worker.respond(request);

    expect(fetchMock.mock.calls.length).toBe(afterFirst);
  });

  it('revalidates unhashed assets so one build cannot be pinned forever', async () => {
    // manifest.webmanifest and the RSC payload keep the same URL across
    // deploys, so a cache-first copy eventually mismatches the app shell.
    fetchMock.mockResolvedValue(fakeResponse(200));
    const worker = loadWorker(fetchMock);
    const request = fakeRequest(`${SCOPE}manifest.webmanifest`);

    await worker.respond(request);
    await flush();
    const afterFirst = fetchMock.mock.calls.length;
    await worker.respond(request);

    expect(fetchMock.mock.calls.length).toBeGreaterThan(afterFirst);
  });

  it('ignores cross-origin requests so Open Library traffic is never intercepted', () => {
    const worker = loadWorker(fetchMock);

    const responded = worker.dispatchFetch(
      fakeRequest('https://covers.openlibrary.org/b/id/12345-L.jpg'),
    );

    expect(responded).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores non-GET requests', () => {
    const worker = loadWorker(fetchMock);

    const responded = worker.dispatchFetch(
      fakeRequest(SCOPE, 'no-cors', 'POST'),
    );

    expect(responded).toBeNull();
  });
});
