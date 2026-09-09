import { describe, expect, it } from 'vitest';

import { availableGenres, genresForBook } from '@/lib/book-features';
import { buildTasteProfile } from '@/lib/taste-profile';
import type { BookMetadataMap, BookRecord } from '@/lib/types';
import { buildYearSummaries, undatedReadCount } from '@/lib/year-summary';

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

function metadata(
  entries: Array<{ bookId: string; subjects: string[] }>,
): BookMetadataMap {
  return Object.fromEntries(
    entries.map(({ bookId, subjects }) => [
      bookId,
      {
        bookId,
        status: 'matched' as const,
        provider: 'open-library' as const,
        providerKey: '/works/example',
        sourceUrl: 'https://openlibrary.org/works/example',
        coverUrl: null,
        subtitle: null,
        synopsis: null,
        subjects,
        publishers: [],
        firstPublishYear: null,
        pageCount: null,
        fetchedAt: '2026-09-08T00:00:00.000Z',
      },
    ]),
  );
}

describe('catalog-powered reading insights', () => {
  it('derives genres from Open Library subjects when Goodreads has no genre shelves', () => {
    const books = [
      book({ id: 'f', title: 'Fantasy', bookshelves: ['to-read'] }),
      book({ id: 'm', title: 'Mystery', bookshelves: ['to-read'] }),
    ];
    const details = metadata([
      { bookId: 'f', subjects: ['Epic fantasy fiction', 'Magic'] },
      { bookId: 'm', subjects: ['Detective and mystery stories'] },
    ]);

    expect(genresForBook(books[0], details)).toContain('fantasy');
    expect(genresForBook(books[1], details)).toContain('mystery-thriller');
    expect(availableGenres(books, details).map((genre) => genre.id)).toEqual([
      'fantasy',
      'mystery-thriller',
    ]);
  });

  it('treats graphic novel as a format while retaining its fantasy genre', () => {
    const books = [book({ id: 'graphic-fantasy', title: 'Graphic fantasy' })];
    const details = metadata([
      {
        bookId: 'graphic-fantasy',
        subjects: ['Graphic novels', 'Fantasy fiction', 'Magic'],
      },
    ]);

    expect(genresForBook(books[0], details)).toEqual(['fantasy']);
    expect(availableGenres(books, details).map((genre) => genre.label)).toEqual(
      ['Fantasy'],
    );
  });

  it('keeps recommendation signals while presenting a narrative-only profile', () => {
    const books = [
      book({ id: 'a1', author: 'Loved Writer', myRating: 5 }),
      book({ id: 'a2', author: 'Loved Writer', myRating: 4 }),
      book({ id: 'g3', author: 'Another Writer', myRating: 5 }),
      book({ id: 'o1', author: 'Other', myRating: 2 }),
    ];
    const details = metadata([
      { bookId: 'a1', subjects: ['Epic fantasy fiction'] },
      { bookId: 'a2', subjects: ['Epic fantasy fiction'] },
      { bookId: 'g3', subjects: ['Epic fantasy fiction'] },
      { bookId: 'o1', subjects: ['History'] },
    ]);
    const profile = buildTasteProfile(books, details);

    expect(profile.favoriteAuthors[0]?.value).toBe('Loved Writer');
    expect(profile.favoriteGenres[0]?.value).toBe('Fantasy');
    expect(profile.favoriteStoryTypes[0]?.value).toBe('Epic & sweeping');
    expect(profile.narrativeInsights[0]?.label).toBe('Epic & sweeping');
    expect(profile.readerSummary).toMatch(/story opens outward/i);
    expect(profile.idealStory).toMatch(/stakes that keep widening/i);
    expect(profile.readerSummary).not.toMatch(
      /Loved Writer|Fantasy|ratings|catalog/i,
    );
  });

  it('builds yearly totals and keeps undated read books visible as a caveat', () => {
    const books = [
      book({ id: 'y1', dateRead: '2026-03-04', myRating: 5, pageCount: 210 }),
      book({ id: 'y2', dateRead: '2026-06-12', myRating: 4, pageCount: 390 }),
      book({ id: 'y3', dateRead: '2025-11-09', myRating: 3, pageCount: 250 }),
      book({ id: 'undated', dateRead: null, myRating: 4 }),
    ];
    const summaries = buildYearSummaries(books);

    expect(summaries.map((summary) => summary.year)).toEqual([2026, 2025]);
    expect(summaries[0]).toMatchObject({
      booksRead: 2,
      averageRating: 4.5,
      totalPages: 600,
      fiveStarCount: 1,
    });
    expect(undatedReadCount(books)).toBe(1);
  });
});
