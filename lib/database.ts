import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import { parseGoodreadsCsv } from '@/lib/goodreads';
import type {
  BackupSnapshot,
  BookMetadata,
  BookRecord,
  ImportSummary,
  LibrarySnapshot,
  MetadataCacheSnapshot,
  MetadataImportSummary,
} from '@/lib/types';

interface NextChapterDb extends DBSchema {
  books: {
    key: string;
    value: BookRecord;
  };
  metadata: {
    key: string;
    value: { key: string; value: string };
  };
  bookMetadata: {
    key: string;
    value: BookMetadata;
  };
}

const dbName = 'next-chapter';
const legacyDbName = 'book-companion';
const emptySnapshot: LibrarySnapshot = {
  books: [],
  bookMetadata: {},
  rankingOrder: [],
  importedAt: null,
  sourceFileName: null,
};

let databasePromise: Promise<IDBPDatabase<NextChapterDb>> | null = null;

function openDatabase(name: string) {
  return openDB<NextChapterDb>(name, 2, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('books')) {
        database.createObjectStore('books', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('metadata')) {
        database.createObjectStore('metadata', { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains('bookMetadata')) {
        database.createObjectStore('bookMetadata', { keyPath: 'bookId' });
      }
    },
  });
}

async function migrateLegacyLibrary(database: IDBPDatabase<NextChapterDb>) {
  if ((await database.count('books')) > 0) return;

  const legacy = await openDatabase(legacyDbName);
  const [books, metadata, bookMetadata] = await Promise.all([
    legacy.getAll('books'),
    legacy.getAll('metadata'),
    legacy.getAll('bookMetadata'),
  ]);
  legacy.close();
  if (
    books.length === 0 &&
    metadata.length === 0 &&
    bookMetadata.length === 0
  ) {
    return;
  }

  const transaction = database.transaction(
    ['books', 'metadata', 'bookMetadata'],
    'readwrite',
  );
  await Promise.all([
    ...books.map((book) => transaction.objectStore('books').put(book)),
    ...metadata.map((entry) => transaction.objectStore('metadata').put(entry)),
    ...bookMetadata.map((entry) =>
      transaction.objectStore('bookMetadata').put(entry),
    ),
  ]);
  await transaction.done;
}

function getDatabase() {
  if (!databasePromise) {
    databasePromise = openDatabase(dbName).then(async (database) => {
      await migrateLegacyLibrary(database);
      return database;
    });
  }
  return databasePromise;
}

async function metadataValue(key: string) {
  const database = await getDatabase();
  return (await database.get('metadata', key))?.value ?? null;
}

function storedStringList(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) &&
      parsed.every((item) => typeof item === 'string')
      ? parsed
      : [];
  } catch {
    return [];
  }
}

export async function getLibrarySnapshot(): Promise<LibrarySnapshot> {
  if (typeof window === 'undefined') return emptySnapshot;
  const database = await getDatabase();
  const [books, bookMetadataRows, rankingOrder, importedAt, sourceFileName] =
    await Promise.all([
      database.getAll('books'),
      database.getAll('bookMetadata'),
      metadataValue('rankingOrder'),
      metadataValue('importedAt'),
      metadataValue('sourceFileName'),
    ]);
  return {
    books,
    bookMetadata: Object.fromEntries(
      bookMetadataRows.map((entry) => [entry.bookId, entry]),
    ),
    rankingOrder: storedStringList(rankingOrder),
    importedAt,
    sourceFileName,
  };
}

export async function importGoodreadsFile(file: File): Promise<ImportSummary> {
  if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
    throw new Error('Choose the goodreads_library_export.csv file.');
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error(
      'This file is larger than 25 MB and cannot be imported safely.',
    );
  }

  const result = parseGoodreadsCsv(await file.text());
  const importedAt = new Date().toISOString();
  const database = await getDatabase();
  const previousMetadata = await database.getAll('bookMetadata');
  const importedIds = new Set(result.books.map((book) => book.id));
  const transaction = database.transaction(
    ['books', 'metadata', 'bookMetadata'],
    'readwrite',
  );

  await transaction.objectStore('books').clear();
  await transaction.objectStore('bookMetadata').clear();
  await Promise.all(
    result.books.map((book) => transaction.objectStore('books').put(book)),
  );
  await Promise.all(
    previousMetadata
      .filter((entry) => importedIds.has(entry.bookId))
      .map((entry) => transaction.objectStore('bookMetadata').put(entry)),
  );
  await transaction.objectStore('metadata').put({
    key: 'importedAt',
    value: importedAt,
  });
  await transaction.objectStore('metadata').put({
    key: 'sourceFileName',
    value: file.name,
  });
  await transaction.done;

  return {
    parsedRows: result.parsedRows,
    importedBooks: result.books.length,
    skippedRows: result.skippedRows,
    warnings: result.warnings,
    fileName: file.name,
    importedAt,
  };
}

export async function clearLocalLibrary() {
  const database = await getDatabase();
  const transaction = database.transaction(
    ['books', 'metadata', 'bookMetadata'],
    'readwrite',
  );
  await transaction.objectStore('books').clear();
  await transaction.objectStore('metadata').clear();
  await transaction.objectStore('bookMetadata').clear();
  await transaction.done;
}

export async function saveBookMetadata(entry: BookMetadata) {
  const database = await getDatabase();
  await database.put('bookMetadata', entry);
}

export async function saveRankingOrder(ids: string[]) {
  const database = await getDatabase();
  await database.put('metadata', {
    key: 'rankingOrder',
    value: JSON.stringify(Array.from(new Set(ids))),
  });
}

function isBookMetadata(value: unknown): value is BookMetadata {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BookMetadata>;
  return (
    typeof candidate.bookId === 'string' &&
    ['matched', 'not-found', 'error'].includes(candidate.status ?? '') &&
    ['open-library', 'manual'].includes(candidate.provider ?? '') &&
    Array.isArray(candidate.subjects) &&
    candidate.subjects.every((subject) => typeof subject === 'string') &&
    Array.isArray(candidate.publishers) &&
    candidate.publishers.every((publisher) => typeof publisher === 'string') &&
    typeof candidate.fetchedAt === 'string'
  );
}

export async function importBookMetadataCache(
  value: unknown,
): Promise<MetadataImportSummary> {
  if (!value || typeof value !== 'object') {
    throw new Error('The catalog file is not valid JSON.');
  }
  const candidate = value as Partial<MetadataCacheSnapshot>;
  if (
    (candidate.format !== 'next-chapter-metadata' &&
      candidate.format !== 'book-companion-metadata') ||
    candidate.version !== 1 ||
    !Array.isArray(candidate.entries) ||
    !candidate.entries.every(isBookMetadata)
  ) {
    throw new Error('This is not a compatible Next Chapter catalog file.');
  }

  const database = await getDatabase();
  const bookIds = new Set(await database.getAllKeys('books'));
  const manualIds = new Set(
    (await database.getAll('bookMetadata'))
      .filter((entry) => entry.provider === 'manual')
      .map((entry) => entry.bookId),
  );
  const matching = new Map<string, BookMetadata>();
  let preservedManual = 0;
  for (const entry of candidate.entries) {
    if (manualIds.has(entry.bookId)) {
      preservedManual += 1;
    } else if (bookIds.has(entry.bookId)) {
      matching.set(entry.bookId, entry);
    }
  }

  const transaction = database.transaction('bookMetadata', 'readwrite');
  await Promise.all(
    Array.from(matching.values()).map((entry) =>
      transaction.objectStore('bookMetadata').put(entry),
    ),
  );
  await transaction.done;
  return {
    imported: matching.size,
    skipped: candidate.entries.length - matching.size - preservedManual,
    preservedManual,
  };
}

export async function createBackup(): Promise<BackupSnapshot> {
  return {
    format: 'next-chapter-backup',
    version: 2,
    createdAt: new Date().toISOString(),
    snapshot: await getLibrarySnapshot(),
  };
}

function isBookRecord(value: unknown): value is BookRecord {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BookRecord>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.author === 'string' &&
    Array.isArray(candidate.bookshelves)
  );
}

export async function restoreBackup(value: unknown) {
  if (!value || typeof value !== 'object') {
    throw new Error('The backup is not valid JSON.');
  }
  const candidate = value as Partial<BackupSnapshot>;
  const version = (candidate as { version?: number }).version;
  if (
    (candidate.format !== 'next-chapter-backup' &&
      candidate.format !== 'book-companion-backup') ||
    (version !== 1 && version !== 2) ||
    !candidate.snapshot ||
    !Array.isArray(candidate.snapshot.books) ||
    !candidate.snapshot.books.every(isBookRecord)
  ) {
    throw new Error('This is not a compatible Next Chapter backup.');
  }

  const database = await getDatabase();
  const transaction = database.transaction(
    ['books', 'metadata', 'bookMetadata'],
    'readwrite',
  );
  await transaction.objectStore('books').clear();
  await transaction.objectStore('bookMetadata').clear();
  await Promise.all(
    candidate.snapshot.books.map((book) =>
      transaction.objectStore('books').put(book),
    ),
  );
  await transaction.objectStore('metadata').put({
    key: 'importedAt',
    value: candidate.snapshot.importedAt ?? new Date().toISOString(),
  });
  await transaction.objectStore('metadata').put({
    key: 'sourceFileName',
    value: candidate.snapshot.sourceFileName ?? 'Next Chapter backup',
  });
  await transaction.objectStore('metadata').put({
    key: 'rankingOrder',
    value: JSON.stringify(candidate.snapshot.rankingOrder ?? []),
  });
  if (version === 2) {
    const bookMetadata = candidate.snapshot.bookMetadata ?? {};
    await Promise.all(
      Object.values(bookMetadata).map((entry) =>
        transaction.objectStore('bookMetadata').put(entry),
      ),
    );
  }
  await transaction.done;
}
