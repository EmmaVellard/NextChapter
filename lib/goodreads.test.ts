import { describe, expect, it } from 'vitest';

import { parseGoodreadsCsv } from '@/lib/goodreads';

const headers = [
  'Book Id',
  'Title',
  'Author',
  'Additional Authors',
  'ISBN',
  'ISBN13',
  'My Rating',
  'Average Rating',
  'Publisher',
  'Binding',
  'Number of Pages',
  'Year Published',
  'Original Publication Year',
  'Date Read',
  'Date Added',
  'Bookshelves',
  'Bookshelves with positions',
  'Exclusive Shelf',
  'My Review',
  'Spoiler',
  'Private Notes',
  'Read Count',
  'Owned Copies',
].join(',');

describe('parseGoodreadsCsv', () => {
  it('keeps Goodreads identifiers and user-owned reading information', () => {
    const csv = `${headers}\n42,"A Book, With a Comma",Ursula Reader,,="0123456789",="9780123456789",5,4.21,Small Press,Paperback,288,2020,2019,2024/01/02,2023/04/05,"favorites, science-fiction","favorites (#1), science-fiction (#2)",read,"Loved it",,,1,1`;
    const result = parseGoodreadsCsv(csv);

    expect(result.books).toHaveLength(1);
    expect(result.books[0]).toMatchObject({
      id: 'goodreads:42',
      title: 'A Book, With a Comma',
      author: 'Ursula Reader',
      isbn: '0123456789',
      isbn13: '9780123456789',
      myRating: 5,
      averageRating: 4.21,
      pageCount: 288,
      exclusiveShelf: 'read',
      dateRead: '2024-01-02',
      dateAdded: '2023-04-05',
      readCount: 1,
    });
    expect(result.books[0].bookshelves).toEqual(
      expect.arrayContaining(['favorites', 'science-fiction', 'read']),
    );
  });

  it('rejects unrelated CSV files with a clear schema error', () => {
    expect(() =>
      parseGoodreadsCsv('name,email\nEmma,reader@example.com'),
    ).toThrow(/Goodreads library export/);
  });
});
