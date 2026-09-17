import { afterEach, describe, expect, it, vi } from 'vitest';

import { enrichBookMetadata, findBookMetadata } from '@/lib/open-library';
import type { BookMetadata, BookRecord } from '@/lib/types';

function book(overrides: Partial<BookRecord>): BookRecord {
  return {
    id: 'book',
    goodreadsId: null,
    title: 'A Known Book',
    author: 'Known Author',
    additionalAuthors: [],
    isbn: '123456789X',
    isbn13: '9781234567890',
    myRating: null,
    averageRating: null,
    publisher: null,
    binding: null,
    pageCount: null,
    yearPublished: null,
    originalPublicationYear: null,
    dateRead: null,
    dateAdded: null,
    bookshelves: ['to-read'],
    exclusiveShelf: 'to-read',
    myReview: null,
    readCount: 0,
    ownedCopies: 0,
    ...overrides,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('Open Library enrichment', () => {
  it('batches an ISBN lookup and stores only the catalog fields the app uses', async () => {
    // /api/books answers 404 for every request now, including known-good ones,
    // so the bulk lookup goes through the search index instead.
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          docs: [
            {
              key: '/works/OL123W',
              title: 'A Known Book',
              subtitle: 'A subtitle',
              isbn: ['9781234567890', '123456789X'],
              cover_i: 42,
              subject: ['Fantasy fiction'],
              publisher: ['Example Press'],
              first_publish_year: 2020,
              number_of_pages_median: 321,
              first_sentence: 'A traveler discovers a hidden city.',
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const saved: BookMetadata[] = [];

    const progress = await enrichBookMetadata({
      books: [book({})],
      existing: {},
      save: async (entry) => {
        saved.push(entry);
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requested = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(requested).toContain('search.json');
    expect(requested).toContain('isbn:(9781234567890');
    expect(progress).toMatchObject({ total: 1, completed: 1, matched: 1 });
    expect(saved[0]).toMatchObject({
      status: 'matched',
      sourceUrl: 'https://openlibrary.org/works/OL123W',
      coverUrl: 'https://covers.openlibrary.org/b/id/42-M.jpg?default=false',
      synopsis: 'A traveler discovers a hidden city.',
      subjects: ['Fantasy fiction'],
      pageCount: 321,
    });
  });

  it('matches a book on any ISBN the edition carries', async () => {
    // A Goodreads export may hold the ISBN-10 while the search index answers
    // with the edition's full list.
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          docs: [
            {
              key: '/works/OL9W',
              title: 'A Known Book',
              isbn: ['9789999999999', '123456789X'],
              cover_i: 7,
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const saved: BookMetadata[] = [];

    await enrichBookMetadata({
      books: [book({ isbn13: null })],
      existing: {},
      save: async (entry) => {
        saved.push(entry);
      },
    });

    expect(saved[0]).toMatchObject({ status: 'matched' });
  });

  it('records a miss as not-found rather than an error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ docs: [] }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const saved: BookMetadata[] = [];

    const progress = await enrichBookMetadata({
      books: [book({})],
      existing: {},
      save: async (entry) => {
        saved.push(entry);
      },
    });

    expect(saved[0]).toMatchObject({ status: 'not-found' });
    expect(progress).toMatchObject({ matched: 0, notFound: 1, errors: 0 });
  });

  it('stops between groups and keeps what it already saved', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          docs: [
            {
              key: '/works/OL1W',
              title: 'A Known Book',
              isbn: ['9781234567890'],
              cover_i: 1,
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const saved: BookMetadata[] = [];

    const progress = await enrichBookMetadata({
      books: Array.from({ length: 24 }, (_, index) =>
        book({ id: `book-${index}`, isbn13: `978123456789${index % 10}` }),
      ),
      existing: {},
      shouldStop: () => saved.length > 0,
      save: async (entry) => {
        saved.push(entry);
      },
    });

    // The first group of eight completes, then the next group is not started.
    expect(saved).toHaveLength(8);
    expect(progress.completed).toBe(8);
  });

  it('finds a cover and synopsis directly for one book', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            docs: [
              {
                key: '/works/OL456W',
                title: 'A Known Book',
                isbn: ['9781234567890'],
                cover_i: 84,
                subject: ['Adventure'],
              },
            ],
          }),
          { status: 200 },
        ),
      )
      // The ISBN hit has no synopsis, so the lookup continues to the title
      // search and then reads the work record for a description.
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            docs: [
              {
                key: '/works/OL456W',
                title: 'A Known Book',
                author_name: ['Known Author'],
                isbn: ['9781234567890'],
                cover_i: 84,
                subject: ['Adventure'],
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            description: 'A direct synopsis found from inside the app.',
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const found = await findBookMetadata(book({}));

    expect(found).toMatchObject({
      status: 'matched',
      coverUrl: 'https://covers.openlibrary.org/b/id/84-M.jpg?default=false',
      synopsis: 'A direct synopsis found from inside the app.',
      subjects: ['Adventure'],
    });
  });

  it('falls back to Google Books when Open Library finds nothing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ docs: [] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: 'gb1',
                volumeInfo: {
                  title: 'A Known Book',
                  description: 'Found through Google Books instead.',
                  categories: ['Fantasy'],
                  infoLink: 'https://books.google.com/books?id=gb1',
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const saved: BookMetadata[] = [];

    await enrichBookMetadata({
      books: [book({})],
      existing: {},
      save: async (entry) => {
        saved.push(entry);
      },
    });

    expect(saved[0]).toMatchObject({
      status: 'matched',
      provider: 'google-books',
      sourceUrl: 'https://books.google.com/books?id=gb1',
      synopsis: 'Found through Google Books instead.',
      subjects: ['Fantasy'],
    });
  });

  it('fills a missing cover from Google Books without replacing Open Library subjects', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            docs: [
              {
                key: '/works/OL1W',
                title: 'A Known Book',
                isbn: ['9781234567890'],
                subject: ['Adventure'],
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: 'gb2',
                volumeInfo: {
                  title: 'A Known Book',
                  categories: ['Should not replace Open Library subjects'],
                  imageLinks: {
                    thumbnail:
                      'http://books.google.com/books/content?id=gb2&zoom=1',
                  },
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const saved: BookMetadata[] = [];

    await enrichBookMetadata({
      books: [book({})],
      existing: {},
      save: async (entry) => {
        saved.push(entry);
      },
    });

    expect(saved[0]).toMatchObject({
      status: 'matched',
      provider: 'open-library',
      coverUrl: 'https://books.google.com/books/content?id=gb2&zoom=2',
      subjects: ['Adventure'],
    });
  });

  it('retries a stale not-found entry but leaves a fresh one alone', async () => {
    const staleEntry: BookMetadata = {
      bookId: 'book',
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
      fetchedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ docs: [] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const progress = await enrichBookMetadata({
      books: [book({})],
      existing: { book: staleEntry },
      save: async () => {},
    });

    expect(progress.total).toBe(1);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('does not retry a not-found entry that was checked recently', async () => {
    const freshEntry: BookMetadata = {
      bookId: 'book',
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
      fetchedAt: new Date().toISOString(),
    };
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const progress = await enrichBookMetadata({
      books: [book({})],
      existing: { book: freshEntry },
      save: async () => {},
    });

    expect(progress.total).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
