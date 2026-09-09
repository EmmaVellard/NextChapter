import { describe, expect, it } from 'vitest';

import { seriesForBook } from '@/lib/series';
import type { BookRecord } from '@/lib/types';

function book(title: string): BookRecord {
  return {
    id: title,
    goodreadsId: null,
    title,
    author: 'Author',
    additionalAuthors: [],
    isbn: null,
    isbn13: null,
    myRating: null,
    averageRating: null,
    publisher: null,
    binding: null,
    pageCount: null,
    yearPublished: null,
    originalPublicationYear: null,
    dateRead: null,
    dateAdded: null,
    bookshelves: [],
    exclusiveShelf: 'to-read',
    myReview: null,
    readCount: 0,
    ownedCopies: 0,
  };
}

describe('series parsing', () => {
  it('reads single positions and omnibus ranges from Goodreads titles', () => {
    expect(seriesForBook(book('Dune Messiah (Dune #2)'))).toMatchObject({
      name: 'Dune',
      position: 2,
      endPosition: 2,
    });
    expect(
      seriesForBook(
        book('Les Lames du Cardinal (Les Lames du Cardinal, #1-3)'),
      ),
    ).toMatchObject({
      name: 'Les Lames du Cardinal',
      position: 1,
      endPosition: 3,
    });
    expect(
      seriesForBook(book('Zorhal: Livre III (French Edition)')),
    ).toMatchObject({ name: 'Zorhal', position: 3, endPosition: 3 });
  });
});
