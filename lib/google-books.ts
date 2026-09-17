import { shortSynopsis } from '@/lib/text';

type VolumeInfo = {
  title?: string;
  subtitle?: string;
  description?: string;
  categories?: string[];
  publisher?: string;
  publishedDate?: string;
  pageCount?: number;
  imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  infoLink?: string;
  canonicalVolumeLink?: string;
};

type Volume = { id?: string; volumeInfo?: VolumeInfo };

type VolumesResponse = { items?: Volume[] };

export type GoogleBooksMatch = {
  providerKey: string | null;
  sourceUrl: string | null;
  coverUrl: string | null;
  subtitle: string | null;
  synopsis: string | null;
  subjects: string[];
  publishers: string[];
  firstPublishYear: number | null;
  pageCount: number | null;
};

function coverUrlFor(imageLinks: VolumeInfo['imageLinks']) {
  const thumbnail = imageLinks?.thumbnail ?? imageLinks?.smallThumbnail;
  if (!thumbnail) return null;
  return thumbnail.replace(/^http:/, 'https:').replace('zoom=1', 'zoom=2');
}

function yearFromPublishedDate(value: string | undefined) {
  const match = value?.match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

function matchFor(volume: Volume | undefined): GoogleBooksMatch | null {
  const info = volume?.volumeInfo;
  if (!volume || !info) return null;
  return {
    providerKey: volume.id ?? null,
    sourceUrl: info.canonicalVolumeLink ?? info.infoLink ?? null,
    coverUrl: coverUrlFor(info.imageLinks),
    subtitle: info.subtitle?.trim() || null,
    synopsis: shortSynopsis(info.description),
    subjects: (info.categories ?? []).slice(0, 40),
    publishers: info.publisher ? [info.publisher] : [],
    firstPublishYear: yearFromPublishedDate(info.publishedDate),
    pageCount: info.pageCount ?? null,
  };
}

async function fetchJson<T>(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Google Books returned ${response.status}.`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function volumes(query: string, maxResults: number) {
  const parameters = new URLSearchParams({ q: query, maxResults: String(maxResults) });
  return fetchJson<VolumesResponse>(
    `https://www.googleapis.com/books/v1/volumes?${parameters.toString()}`,
    15_000,
  );
}

/** No API key, personal-use volume of requests: pace between calls the same way `open-library.ts` paces Open Library requests. */
export function waitForGoogleBooksRateLimit() {
  return new Promise((resolve) => setTimeout(resolve, 550));
}

export async function findByIsbn(isbn: string) {
  const result = await volumes(`isbn:${isbn}`, 1);
  return matchFor(result.items?.[0]);
}

export async function findByTitleAuthor(title: string, author: string) {
  const query = `intitle:"${title.replace(/"/g, '')}"+inauthor:"${author.replace(/"/g, '')}"`;
  const result = await volumes(query, 3);
  return matchFor(result.items?.[0]);
}
