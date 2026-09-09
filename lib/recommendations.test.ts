import { describe, expect, it } from 'vitest';

import { recommendBooks } from '@/lib/recommendations';
import { buildTasteProfile } from '@/lib/taste-profile';
import type { BookRecord } from '@/lib/types';

function book(overrides: Partial<BookRecord>): BookRecord {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    goodreadsId: null,
    title: 'Book',
    author: 'Author',
    additionalAuthors: [],
    isbn: null,
    isbn13: null,
    myRating: null,
    averageRating: 3.9,
    publisher: null,
    binding: null,
    pageCount: 300,
    yearPublished: 2020,
    originalPublicationYear: 2020,
    dateRead: null,
    dateAdded: '2026-01-01',
    bookshelves: [],
    exclusiveShelf: 'read',
    myReview: null,
    readCount: 1,
    ownedCopies: 0,
    ...overrides,
  };
}

describe('recommendBooks', () => {
  it('uses repeated author preference without allowing one rating to dominate', () => {
    const books = [
      book({ id: 'r1', author: 'Loved Author', myRating: 5 }),
      book({ id: 'r2', author: 'Loved Author', myRating: 4 }),
      book({ id: 'r3', author: 'Other Author', myRating: 2 }),
      book({
        id: 't1',
        title: 'Next by Loved',
        author: 'Loved Author',
        exclusiveShelf: 'to-read',
        readCount: 0,
        averageRating: 3.7,
      }),
      book({
        id: 't2',
        title: 'Very Popular',
        author: 'New Author',
        exclusiveShelf: 'to-read',
        readCount: 0,
        averageRating: 4.3,
      }),
    ];
    const result = recommendBooks({
      books,
      profile: buildTasteProfile(books),
      context: { genre: 'any', length: 'any', discovery: 'balanced' },
    });

    expect(result[0].book.id).toBe('t1');
    expect(result[0].reasons[0]).toMatch(/Loved Author/);
  });

  it('treats a selected length as a hard constraint', () => {
    const books = [
      book({
        id: 'short',
        title: 'Short',
        exclusiveShelf: 'to-read',
        readCount: 0,
        pageCount: 180,
      }),
      book({
        id: 'long',
        title: 'Long',
        exclusiveShelf: 'to-read',
        readCount: 0,
        pageCount: 700,
        averageRating: 4.8,
      }),
    ];
    const result = recommendBooks({
      books,
      profile: buildTasteProfile(books),
      context: { genre: 'any', length: 'short', discovery: 'balanced' },
    });

    expect(result.map((item) => item.book.id)).toEqual(['short']);
  });

  it('uses Goodreads custom shelves as a strict genre filter', () => {
    const books = [
      book({
        id: 'fantasy',
        title: 'Fantasy Pick',
        exclusiveShelf: 'to-read',
        readCount: 0,
        bookshelves: ['to-read', 'epic-fantasy'],
      }),
      book({
        id: 'mystery',
        title: 'Mystery Pick',
        exclusiveShelf: 'to-read',
        readCount: 0,
        bookshelves: ['to-read', 'mystery'],
        averageRating: 4.8,
      }),
    ];
    const result = recommendBooks({
      books,
      profile: buildTasteProfile(books),
      context: {
        genre: 'fantasy',
        length: 'any',
        discovery: 'balanced',
      },
    });

    expect(result.map((item) => item.book.id)).toEqual(['fantasy']);
    expect(result[0].reasons[0]).toMatch(/Fantasy/);
  });

  it('keeps recommendations at the next unread position in a series', () => {
    const books = [
      book({ id: 'r1', title: 'Red Rising (Red Rising Saga, #1)' }),
      book({ id: 'r2', title: 'Golden Son (Red Rising Saga, #2)' }),
      book({ id: 'r3', title: 'Morning Star (Red Rising Saga, #3)' }),
      book({
        id: 'next',
        title: 'Iron Gold (Red Rising Saga, #4)',
        exclusiveShelf: 'to-read',
        readCount: 0,
      }),
      book({
        id: 'too-far',
        title: 'Red God (Red Rising Saga, #7)',
        exclusiveShelf: 'to-read',
        readCount: 0,
        averageRating: 5,
      }),
    ];
    const result = recommendBooks({
      books,
      profile: buildTasteProfile(books),
      context: { genre: 'any', length: 'any', discovery: 'balanced' },
    });

    expect(result.map((item) => item.book.id)).toEqual(['next']);
    expect(result[0].reasons[0]).toMatch(/after 3/);
  });

  it('uses not-now and too-long feedback as future constraints', () => {
    const books = [
      book({
        id: 'dismissed',
        exclusiveShelf: 'to-read',
        readCount: 0,
        pageCount: 180,
      }),
      book({
        id: 'too-long',
        exclusiveShelf: 'to-read',
        readCount: 0,
        pageCount: 700,
      }),
      book({
        id: 'shorter',
        exclusiveShelf: 'to-read',
        readCount: 0,
        pageCount: 320,
      }),
      book({
        id: 'unknown-length',
        exclusiveShelf: 'to-read',
        readCount: 0,
        pageCount: null,
      }),
    ];
    const result = recommendBooks({
      books,
      profile: buildTasteProfile(books),
      context: { genre: 'any', length: 'any', discovery: 'balanced' },
      feedback: [
        {
          bookId: 'dismissed',
          action: 'not-now',
          pageCount: 180,
          createdAt: '2026-09-08T00:00:00.000Z',
        },
        {
          bookId: 'too-long',
          action: 'too-long',
          pageCount: 700,
          createdAt: '2026-09-08T00:01:00.000Z',
        },
      ],
    });

    expect(result.map((item) => item.book.id)).toEqual(['shorter']);
  });

  it('boosts books with story traits shared by a more-like-this pick', () => {
    const books = [
      book({
        id: 'seed',
        author: 'Shared Author',
        exclusiveShelf: 'to-read',
        bookshelves: ['to-read', 'dark-fantasy'],
        readCount: 0,
      }),
      book({
        id: 'similar',
        author: 'Shared Author',
        exclusiveShelf: 'to-read',
        bookshelves: ['to-read', 'dark-fantasy'],
        averageRating: 3.9,
        readCount: 0,
      }),
      book({
        id: 'popular',
        author: 'Other Author',
        exclusiveShelf: 'to-read',
        bookshelves: ['to-read', 'mystery'],
        averageRating: 4.4,
        readCount: 0,
      }),
    ];
    const result = recommendBooks({
      books,
      profile: buildTasteProfile(books),
      context: { genre: 'any', length: 'any', discovery: 'balanced' },
      excludedIds: ['seed'],
      feedback: [
        {
          bookId: 'seed',
          action: 'more-like-this',
          pageCount: 300,
          createdAt: '2026-09-08T00:00:00.000Z',
        },
      ],
    });

    expect(result[0].book.id).toBe('similar');
    expect(result[0].reasons[0]).toMatch(/story shape/i);
  });
});
