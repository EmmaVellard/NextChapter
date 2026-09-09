import { afterEach, describe, expect, it, vi } from 'vitest';

import { enrichBookMetadata } from '@/lib/open-library';
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            'ISBN:9781234567890': {
              key: '/books/OL123M',
              url: 'http://openlibrary.org/books/OL123M',
              title: 'A Known Book',
              subtitle: 'A subtitle',
              number_of_pages: 321,
              publish_date: '2020',
              subjects: [{ name: 'Fantasy fiction' }],
              publishers: [{ name: 'Example Press' }],
              cover: {
                medium: 'http://covers.openlibrary.org/b/id/42-M.jpg',
              },
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            'ISBN:9781234567890': {
              details: {
                description:
                  'A traveler discovers a hidden city and must decide whether to reveal its secret.',
              },
            },
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const saved: BookMetadata[] = [];

    const progress = await enrichBookMetadata({
      books: [book({})],
      existing: {},
      includeDescriptions: true,
      save: async (entry) => {
        saved.push(entry);
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      'bibkeys=ISBN%3A9781234567890',
    );
    expect(progress).toMatchObject({ total: 1, completed: 1, matched: 1 });
    expect(saved[0]).toMatchObject({
      status: 'matched',
      sourceUrl: 'https://openlibrary.org/books/OL123M',
      coverUrl: 'https://covers.openlibrary.org/b/id/42-M.jpg',
      synopsis:
        'A traveler discovers a hidden city and must decide whether to reveal its secret.',
      subjects: ['Fantasy fiction'],
      pageCount: 321,
    });
  });
});
