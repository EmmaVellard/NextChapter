import { describe, expect, it } from 'vitest';

import { feedbackAlignment } from '@/lib/recommendation-diagnostics';
import { buildTasteProfile } from '@/lib/taste-profile';
import type { BookRecord, RecommendationFeedback } from '@/lib/types';

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

function feedbackEntry(
  bookId: string,
  action: RecommendationFeedback['action'],
): RecommendationFeedback {
  return { bookId, action, pageCount: null, createdAt: '2026-01-01T00:00:00Z' };
}

describe('feedbackAlignment', () => {
  it('returns null when either bucket has too few samples', () => {
    const ratedBooks = Array.from({ length: 6 }, (_, index) =>
      book({ id: `rated-${index}`, author: 'Loved Author', myRating: 5 }),
    );
    const feedback = [
      feedbackEntry('rated-0', 'more-like-this'),
      feedbackEntry('rated-1', 'not-now'),
    ];

    expect(
      feedbackAlignment({
        feedback,
        books: ratedBooks,
        profile: buildTasteProfile(ratedBooks),
        metadata: {},
      }),
    ).toBeNull();
  });

  it('reports higher taste fit for more-like-this books than dismissed ones', () => {
    const ratedBooks = Array.from({ length: 6 }, (_, index) =>
      book({ id: `rated-${index}`, author: 'Loved Author', myRating: 5 }),
    );
    const likedCandidates = Array.from({ length: 4 }, (_, index) =>
      book({
        id: `liked-${index}`,
        author: 'Loved Author',
        exclusiveShelf: 'to-read',
        readCount: 0,
      }),
    );
    const passedCandidates = Array.from({ length: 4 }, (_, index) =>
      book({
        id: `passed-${index}`,
        author: `Unrelated Author ${index}`,
        exclusiveShelf: 'to-read',
        readCount: 0,
      }),
    );
    const allBooks = [...ratedBooks, ...likedCandidates, ...passedCandidates];
    const feedback = [
      ...likedCandidates.map((candidate) =>
        feedbackEntry(candidate.id, 'more-like-this' as const),
      ),
      ...passedCandidates.map((candidate) =>
        feedbackEntry(candidate.id, 'not-now' as const),
      ),
    ];

    const result = feedbackAlignment({
      feedback,
      books: allBooks,
      profile: buildTasteProfile(ratedBooks),
      metadata: {},
    });

    expect(result).not.toBeNull();
    expect(result?.likedCount).toBe(4);
    expect(result?.passedCount).toBe(4);
    expect(result?.aligned).toBe(true);
    expect(result?.likedAverage).toBeGreaterThan(result?.passedAverage ?? 0);
  });

  it('skips feedback entries whose book no longer exists', () => {
    const ratedBooks = Array.from({ length: 6 }, (_, index) =>
      book({ id: `rated-${index}`, myRating: 5 }),
    );
    const feedback = [feedbackEntry('missing-book', 'more-like-this')];

    expect(() =>
      feedbackAlignment({
        feedback,
        books: ratedBooks,
        profile: buildTasteProfile(ratedBooks),
        metadata: {},
      }),
    ).not.toThrow();
  });
});
