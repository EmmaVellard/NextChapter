import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { parseGoodreadsCsv } from '../lib/goodreads.ts';
import { enrichBookMetadata } from '../lib/open-library.ts';
import type { BookMetadata, MetadataCacheSnapshot } from '../lib/types.ts';

const source = process.argv[2];
const destination = process.argv[3];

if (!source || !destination) {
  throw new Error(
    'Usage: enrich-library-metadata <goodreads.csv> <catalog-details.json>',
  );
}

const { books } = parseGoodreadsCsv(await readFile(resolve(source), 'utf8'));
const entries = new Map<string, BookMetadata>();
let lastReported = -1;

const progress = await enrichBookMetadata({
  books,
  existing: {},
  includeTitleFallback: false,
  save: async (entry) => {
    entries.set(entry.bookId, entry);
  },
  onProgress: (current) => {
    const milestone = Math.floor(current.completed / 10) * 10;
    if (milestone > lastReported || current.completed === current.total) {
      lastReported = milestone;
      process.stdout.write(
        `Checked ${current.completed}/${current.total} · ${current.matched} matched · ${current.errors} retryable\n`,
      );
    }
  },
});

const cache: MetadataCacheSnapshot = {
  format: 'next-chapter-metadata',
  version: 1,
  createdAt: new Date().toISOString(),
  entries: Array.from(entries.values()),
};

await writeFile(resolve(destination), JSON.stringify(cache, null, 2));
process.stdout.write(
  `Saved ${cache.entries.length} records: ${progress.matched} matched, ${progress.notFound} not found, ${progress.errors} retryable.\n`,
);
