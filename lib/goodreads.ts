import Papa from 'papaparse';

import type { BookRecord, GoodreadsParseResult } from '@/lib/types';

type CsvRow = Record<string, string | undefined>;

const requiredHeaders = ['Title', 'Author', 'Exclusive Shelf'];

function clean(value: string | undefined) {
  const normalized = value?.trim() ?? '';
  return normalized || null;
}

function cleanIsbn(value: string | undefined) {
  const normalized = clean(value);
  if (!normalized) return null;
  const unwrapped = normalized
    .replace(/^="(.*)"$/, '$1')
    .replace(/[^0-9Xx]/g, '');
  return unwrapped || null;
}

function numberOrNull(value: string | undefined) {
  const normalized = clean(value);
  if (!normalized) return null;
  const parsed = Number(normalized.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveInteger(value: string | undefined) {
  const parsed = numberOrNull(value);
  return parsed && parsed > 0 ? Math.round(parsed) : null;
}

function splitList(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeRating(value: string | undefined) {
  const parsed = numberOrNull(value);
  return parsed && parsed > 0 && parsed <= 5 ? parsed : null;
}

function normalizeDate(value: string | undefined) {
  const normalized = clean(value);
  if (!normalized) return null;
  const match = normalized.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return normalized;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function stableId(row: CsvRow) {
  const goodreadsId = clean(row['Book Id']);
  if (goodreadsId) return `goodreads:${goodreadsId}`;
  const isbn13 = cleanIsbn(row['ISBN13']);
  if (isbn13) return `isbn13:${isbn13}`;
  const key =
    `${clean(row['Title']) ?? ''}|${clean(row['Author']) ?? ''}`.toLowerCase();
  return `book:${stableHash(key)}`;
}

function rowToBook(row: CsvRow): BookRecord | null {
  const title = clean(row['Title']);
  const author = clean(row['Author']);
  if (!title || !author) return null;

  const exclusiveShelf = (clean(row['Exclusive Shelf']) ?? '').toLowerCase();
  const bookshelves = Array.from(
    new Set([
      ...splitList(row['Bookshelves']),
      ...splitList(row['Bookshelves with positions']).map((shelf) =>
        shelf.replace(/\s*\(#\d+\)$/, ''),
      ),
      exclusiveShelf,
    ]),
  ).filter(Boolean);

  return {
    id: stableId(row),
    goodreadsId: clean(row['Book Id']),
    title,
    author,
    additionalAuthors: (row['Additional Authors'] ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
    isbn: cleanIsbn(row['ISBN']),
    isbn13: cleanIsbn(row['ISBN13']),
    myRating: normalizeRating(row['My Rating']),
    averageRating: normalizeRating(row['Average Rating']),
    publisher: clean(row['Publisher']),
    binding: clean(row['Binding']),
    pageCount: positiveInteger(row['Number of Pages']),
    yearPublished: positiveInteger(row['Year Published']),
    originalPublicationYear: positiveInteger(row['Original Publication Year']),
    dateRead: normalizeDate(row['Date Read']),
    dateAdded: normalizeDate(row['Date Added']),
    bookshelves,
    exclusiveShelf,
    myReview: clean(row['My Review']),
    readCount: positiveInteger(row['Read Count']) ?? 0,
    ownedCopies: positiveInteger(row['Owned Copies']) ?? 0,
  };
}

export function parseGoodreadsCsv(text: string): GoodreadsParseResult {
  const parsed = Papa.parse<CsvRow>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(),
  });

  if (parsed.errors.some((error) => error.type === 'Delimiter')) {
    throw new Error('This file does not look like a readable CSV export.');
  }

  const headers = parsed.meta.fields ?? [];
  const missingHeaders = requiredHeaders.filter(
    (header) => !headers.includes(header),
  );
  if (missingHeaders.length > 0) {
    throw new Error(
      `This does not look like a Goodreads library export. Missing: ${missingHeaders.join(', ')}.`,
    );
  }

  const warnings: string[] = [];
  const uniqueBooks = new Map<string, BookRecord>();
  let skippedRows = 0;

  for (const row of parsed.data) {
    const book = rowToBook(row);
    if (!book) {
      skippedRows += 1;
      continue;
    }
    if (uniqueBooks.has(book.id)) {
      warnings.push(`A duplicate row for “${book.title}” was merged.`);
    }
    uniqueBooks.set(book.id, book);
  }

  if (uniqueBooks.size === 0) {
    throw new Error('No books with both a title and author were found.');
  }

  if (parsed.errors.length > 0) {
    warnings.push(
      `${parsed.errors.length} CSV formatting ${parsed.errors.length === 1 ? 'issue was' : 'issues were'} handled while reading the file.`,
    );
  }

  return {
    books: Array.from(uniqueBooks.values()),
    parsedRows: parsed.data.length,
    skippedRows,
    warnings: Array.from(new Set(warnings)).slice(0, 8),
  };
}
