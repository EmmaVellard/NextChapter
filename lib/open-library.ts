import type {
  BookMetadata,
  BookMetadataMap,
  BookRecord,
  MetadataProgress,
} from '@/lib/types';

type SearchDocument = {
  key?: string;
  title?: string;
  subtitle?: string;
  author_name?: string[];
  isbn?: string[];
  cover_i?: number;
  first_sentence?: string | string[];
  subject?: string[];
  publisher?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
};

type SearchResponse = { docs?: SearchDocument[] };

type WorkResponse = {
  description?: string | { value?: string };
};

const searchFields = [
  'key',
  'title',
  'subtitle',
  'author_name',
  'isbn',
  'cover_i',
  'first_sentence',
  'subject',
  'publisher',
  'first_publish_year',
  'number_of_pages_median',
].join(',');

function normalize(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function searchTitle(value: string) {
  return value
    .replace(/\s*\([^)]*#\d+[^)]*\)\s*$/i, '')
    .replace(/\s*\[[^\]]*#\d+[^\]]*\]\s*$/i, '')
    .trim();
}

function isbnValues(book: BookRecord) {
  return [book.isbn13, book.isbn].filter((value): value is string => !!value);
}

function preferredIsbn(book: BookRecord) {
  return book.isbn13 ?? book.isbn;
}

function titleQueryValue(value: string) {
  return `"${value.replace(/[\\"]/g, ' ').trim()}"`;
}

function firstSentence(value: SearchDocument['first_sentence']) {
  const sentence = Array.isArray(value) ? value[0] : value;
  if (!sentence) return null;
  return (
    sentence
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim() || null
  );
}

function shortSynopsis(value: string | { value?: string } | undefined) {
  const raw = typeof value === 'string' ? value : value?.value;
  if (!raw) return null;
  const clean = raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return null;
  if (clean.length <= 420) return clean;
  const excerpt = clean.slice(0, 420);
  const sentenceEnd = Math.max(
    excerpt.lastIndexOf('. '),
    excerpt.lastIndexOf('! '),
    excerpt.lastIndexOf('? '),
  );
  if (sentenceEnd >= 180) return excerpt.slice(0, sentenceEnd + 1);
  const wordEnd = excerpt.lastIndexOf(' ');
  return `${excerpt.slice(0, wordEnd > 0 ? wordEnd : 420)}…`;
}

function matchScore(book: BookRecord, document: SearchDocument) {
  const bookIsbns = new Set(isbnValues(book));
  const exactIsbn = (document.isbn ?? []).some((isbn) => bookIsbns.has(isbn));
  const title = normalize(searchTitle(book.title));
  const documentTitle = normalize(document.title);
  const exactTitle = title === documentTitle;
  const closeTitle =
    title.length > 5 &&
    (title.includes(documentTitle) || documentTitle.includes(title));
  const author = normalize(book.author);
  const authorMatch = (document.author_name ?? []).some((name) => {
    const candidate = normalize(name);
    return (
      candidate === author ||
      candidate.includes(author) ||
      author.includes(candidate)
    );
  });
  return (
    (exactIsbn ? 10 : 0) +
    (exactTitle ? 5 : closeTitle ? 2 : 0) +
    (authorMatch ? 3 : 0)
  );
}

function bestMatch(book: BookRecord, documents: SearchDocument[]) {
  const ranked = documents
    .map((document) => ({ document, score: matchScore(book, document) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const minimum = isbnValues(book).length > 0 ? 8 : 7;
  return best && best.score >= minimum ? best.document : null;
}

function metadataFor(
  book: BookRecord,
  document: SearchDocument | null,
): BookMetadata {
  const fetchedAt = new Date().toISOString();
  if (!document) {
    return {
      bookId: book.id,
      status: 'not-found',
      provider: 'open-library',
      providerKey: null,
      sourceUrl: null,
      coverUrl: null,
      subtitle: null,
      synopsis: null,
      subjects: [],
      publishers: [],
      firstPublishYear: null,
      pageCount: null,
      fetchedAt,
    };
  }
  const key = document.key?.startsWith('/')
    ? document.key
    : document.key
      ? `/works/${document.key}`
      : null;
  return {
    bookId: book.id,
    status: 'matched',
    provider: 'open-library',
    providerKey: key,
    sourceUrl: key ? `https://openlibrary.org${key}` : null,
    coverUrl: document.cover_i
      ? `https://covers.openlibrary.org/b/id/${document.cover_i}-M.jpg?default=false`
      : null,
    subtitle: document.subtitle?.trim() || null,
    synopsis: firstSentence(document.first_sentence),
    subjects: (document.subject ?? []).slice(0, 40),
    publishers: (document.publisher ?? []).slice(0, 6),
    firstPublishYear: document.first_publish_year ?? null,
    pageCount: document.number_of_pages_median ?? null,
    fetchedAt,
  };
}

function errorMetadata(book: BookRecord): BookMetadata {
  return { ...metadataFor(book, null), status: 'error' };
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
      throw new Error(`Open Library returned ${response.status}.`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Looks a group of ISBNs up through the search index.
 *
 * The /api/books endpoint this used to call now answers 404 for every request,
 * including ones that are known good, so the bulk lookup marked whole groups as
 * errors. search.json accepts an isbn: query, batches the same way, and returns
 * the fields the product actually stores. Results come back keyed by every ISBN
 * the edition carries, so a book matches on whichever one its export holds.
 */
async function documentsByIsbn(books: BookRecord[]) {
  const isbns = books.flatMap(isbnValues);
  if (isbns.length === 0) return new Map<string, SearchDocument>();
  const result = await search(`isbn:(${isbns.join(' OR ')})`, isbns.length * 2);
  const byIsbn = new Map<string, SearchDocument>();
  for (const document of result.docs ?? []) {
    for (const isbn of document.isbn ?? []) {
      if (!byIsbn.has(isbn)) byIsbn.set(isbn, document);
    }
  }
  return byIsbn;
}

function documentForBook(
  byIsbn: Map<string, SearchDocument>,
  book: BookRecord,
) {
  for (const isbn of isbnValues(book)) {
    const found = byIsbn.get(isbn);
    if (found) return found;
  }
  return null;
}

async function search(query: string, limit: number) {
  const parameters = new URLSearchParams({
    q: query,
    fields: searchFields,
    limit: String(limit),
  });
  return fetchJson<SearchResponse>(
    `https://openlibrary.org/search.json?${parameters.toString()}`,
    15_000,
  );
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function waitForRateLimit() {
  return new Promise((resolve) => setTimeout(resolve, 1050));
}

function mergeFoundMetadata(
  primary: BookMetadata | null,
  fallback: BookMetadata,
) {
  if (!primary || primary.status !== 'matched') return fallback;
  if (fallback.status !== 'matched') return primary;
  return {
    ...fallback,
    providerKey: primary.providerKey ?? fallback.providerKey,
    sourceUrl: primary.sourceUrl ?? fallback.sourceUrl,
    coverUrl: primary.coverUrl ?? fallback.coverUrl,
    subtitle: primary.subtitle ?? fallback.subtitle,
    synopsis: primary.synopsis ?? fallback.synopsis,
    subjects:
      primary.subjects.length > 0 ? primary.subjects : fallback.subjects,
    publishers:
      primary.publishers.length > 0 ? primary.publishers : fallback.publishers,
    firstPublishYear: primary.firstPublishYear ?? fallback.firstPublishYear,
    pageCount: primary.pageCount ?? fallback.pageCount,
  };
}

export async function findBookMetadata(book: BookRecord) {
  const isbn = preferredIsbn(book);
  let isbnMetadata: BookMetadata | null = null;

  if (isbn) {
    try {
      const byIsbn = await documentsByIsbn([book]);
      isbnMetadata = metadataFor(book, documentForBook(byIsbn, book));
    } catch {
      // A title-and-author search below can still find another edition.
    }
  }

  try {
    if (isbnMetadata?.coverUrl && isbnMetadata.synopsis) return isbnMetadata;
    if (isbn) await waitForRateLimit();
    const result = await search(
      `title:${titleQueryValue(searchTitle(book.title))} author:${titleQueryValue(book.author)}`,
      20,
    );
    const matched = bestMatch(book, result.docs ?? []);
    let searched = metadataFor(book, matched);
    if (searched.providerKey?.startsWith('/works/')) {
      await waitForRateLimit();
      try {
        const work = await fetchJson<WorkResponse>(
          `https://openlibrary.org${searched.providerKey}.json`,
          15_000,
        );
        searched = {
          ...searched,
          synopsis: shortSynopsis(work.description) ?? searched.synopsis,
        };
      } catch {
        // Search results may still include a cover and useful book details.
      }
    }
    return mergeFoundMetadata(isbnMetadata, searched);
  } catch (error) {
    if (isbnMetadata?.status === 'matched') return isbnMetadata;
    throw error;
  }
}

export async function enrichBookMetadata({
  books,
  existing,
  save,
  onProgress,
  includeTitleFallback = false,
  shouldStop,
}: {
  books: BookRecord[];
  existing: BookMetadataMap;
  save: (metadata: BookMetadata) => Promise<void>;
  onProgress?: (progress: MetadataProgress) => void;
  includeTitleFallback?: boolean;
  /**
   * Checked between request groups. Everything already saved stays, and the
   * next run resumes from there, because books that already carry metadata are
   * filtered out of `pending` above.
   */
  shouldStop?: () => boolean;
}) {
  const pending = books.filter(
    (book) => !existing[book.id] || existing[book.id]?.status === 'error',
  );
  const withIsbn = pending.filter((book) => isbnValues(book).length > 0);
  const withoutIsbn = pending.filter((book) => isbnValues(book).length === 0);
  const targetBooks = includeTitleFallback ? pending : withIsbn;
  const groups = [
    ...chunks(withIsbn, 8).map((group) => ({ kind: 'isbn' as const, group })),
    ...(includeTitleFallback
      ? chunks(withoutIsbn, 8).map((group) => ({
          kind: 'title' as const,
          group,
        }))
      : []),
  ];
  const progress: MetadataProgress = {
    completed: 0,
    total: targetBooks.length,
    matched: 0,
    notFound: 0,
    errors: 0,
  };
  onProgress?.({ ...progress });

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    if (shouldStop?.()) break;
    const { group, kind } = groups[groupIndex];
    try {
      if (kind === 'isbn') {
        const byIsbn = await documentsByIsbn(group);
        for (const book of group) {
          const metadata = metadataFor(book, documentForBook(byIsbn, book));
          await save(metadata);
          progress.completed += 1;
          if (metadata.status === 'matched') progress.matched += 1;
          else progress.notFound += 1;
          onProgress?.({ ...progress });
        }
      } else {
        const query = `title:(${group
          .map((book) => titleQueryValue(searchTitle(book.title)))
          .join(' OR ')})`;
        const result = await search(query, 80);
        const documents = result.docs ?? [];
        for (const book of group) {
          const metadata = metadataFor(book, bestMatch(book, documents));
          await save(metadata);
          progress.completed += 1;
          if (metadata.status === 'matched') progress.matched += 1;
          else progress.notFound += 1;
          onProgress?.({ ...progress });
        }
      }
    } catch {
      for (const book of group) {
        await save(errorMetadata(book));
        progress.completed += 1;
        progress.errors += 1;
        onProgress?.({ ...progress });
      }
    }
    if (groupIndex < groups.length - 1) await waitForRateLimit();
  }

  return progress;
}
