import { describe, expect, it } from 'vitest';

import { describeBackup, isRiskyReplacement } from '@/lib/database';
import type { BookRecord, PreparedImport } from '@/lib/types';

function book(id: string): BookRecord {
  return {
    id,
    goodreadsId: id,
    title: `Book ${id}`,
    author: 'An Author',
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

function prepared(incoming: number, existingCount: number): PreparedImport {
  return {
    result: {
      books: Array.from({ length: incoming }, (_, index) =>
        book(String(index)),
      ),
      parsedRows: incoming,
      skippedRows: 0,
      warnings: [],
    },
    fileName: 'goodreads_library_export.csv',
    existingCount,
    existingFileName: 'goodreads_library_export.csv',
  };
}

function backup(books: BookRecord[]) {
  return {
    format: 'next-chapter-backup',
    version: 2,
    createdAt: '2026-09-16T00:00:00.000Z',
    snapshot: {
      books,
      sourceFileName: 'goodreads_library_export.csv',
      importedAt: '2026-09-16T00:00:00.000Z',
    },
  };
}

describe('import replacement safety', () => {
  it('warns when an import would discard most of the library', () => {
    // The whole library is replaced by every import, so a much smaller file is
    // usually the wrong export rather than an intentional update.
    expect(isRiskyReplacement(prepared(40, 500))).toBe(true);
  });

  it('does not warn when the library grows or barely changes', () => {
    expect(isRiskyReplacement(prepared(520, 500))).toBe(false);
    expect(isRiskyReplacement(prepared(480, 500))).toBe(false);
  });

  it('does not warn on the first import into an empty library', () => {
    expect(isRiskyReplacement(prepared(500, 0))).toBe(false);
  });

  it('treats exactly half as the boundary, not a warning', () => {
    expect(isRiskyReplacement(prepared(250, 500))).toBe(false);
    expect(isRiskyReplacement(prepared(249, 500))).toBe(true);
  });
});

describe('backup validation', () => {
  it('reports the count so a confirmation can name it', () => {
    expect(describeBackup(backup([book('1'), book('2')]))).toMatchObject({
      books: 2,
      sourceFileName: 'goodreads_library_export.csv',
    });
  });

  it('refuses an empty backup instead of emptying the library', () => {
    // restoreBackup clears the stores first, so restoring an empty snapshot
    // silently destroyed the only copy of the library.
    expect(() => describeBackup(backup([]))).toThrow(/no books/i);
  });

  it('refuses a file that is not a Next Chapter backup', () => {
    expect(() =>
      describeBackup({ format: 'something-else', version: 2 }),
    ).toThrow(/not a compatible/i);
    expect(() => describeBackup(null)).toThrow(/not valid JSON/i);
  });

  it('still accepts backups written under the old product name', () => {
    const legacy = { ...backup([book('1')]), format: 'book-companion-backup' };
    expect(describeBackup(legacy).books).toBe(1);
  });
});
