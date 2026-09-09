import { describe, expect, it } from 'vitest';

import { rankReadBooks } from '@/lib/book-ranking';
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
    myRating: 4,
    averageRating: 4,
    publisher: null,
    binding: null,
    pageCount: 300,
    yearPublished: 2020,
    originalPublicationYear: 2020,
    dateRead: '2026-01-01',
    dateAdded: null,
    bookshelves: ['read'],
    exclusiveShelf: 'read',
    myReview: null,
    readCount: 1,
    ownedCopies: 0,
    ...overrides,
  };
}

describe('book ranking', () => {
  it('uses personal rating first and Goodreads only to break ties', () => {
    const ranked = rankReadBooks([
      book({ id: 'community', myRating: 4, averageRating: 4.9 }),
      book({ id: 'favorite', myRating: 5, averageRating: 3.5 }),
      book({ id: 'tie', myRating: 4, averageRating: 4.2 }),
      book({ id: 'unrated', myRating: null }),
    ]);

    expect(ranked.map((item) => item.id)).toEqual([
      'favorite',
      'community',
      'tie',
    ]);
  });

  it('respects a saved personal order and leaves unlisted books afterward', () => {
    const books = [
      book({ id: 'five-stars', myRating: 5 }),
      book({ id: 'four-stars', myRating: 4 }),
      book({ id: 'three-stars', myRating: 3 }),
    ];

    expect(rankReadBooks(books, ['four-stars', 'five-stars'])).toEqual([
      books[1],
      books[0],
      books[2],
    ]);
  });
});
