import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { BookMetadata, MetadataCacheSnapshot } from '../lib/types.ts';

const [baseSource, updateSource, destination] = process.argv.slice(2);

if (!baseSource || !updateSource || !destination) {
  throw new Error(
    'Usage: merge-catalog-files <base.json> <update.json> <destination.json>',
  );
}

async function readCache(path: string) {
  const value = JSON.parse(
    await readFile(resolve(path), 'utf8'),
  ) as Partial<MetadataCacheSnapshot>;
  if (
    (value.format !== 'next-chapter-metadata' &&
      value.format !== 'book-companion-metadata') ||
    value.version !== 1 ||
    !Array.isArray(value.entries)
  ) {
    throw new Error(`${path} is not a Next Chapter catalog file.`);
  }
  return value.entries;
}

const base = await readCache(baseSource);
const update = await readCache(updateSource);
const merged = new Map<string, BookMetadata>(
  base.map((entry) => [entry.bookId, entry]),
);

for (const entry of update) {
  const previous = merged.get(entry.bookId);
  if (entry.status !== 'error' || !previous) merged.set(entry.bookId, entry);
}

const result: MetadataCacheSnapshot = {
  format: 'next-chapter-metadata',
  version: 1,
  createdAt: new Date().toISOString(),
  entries: Array.from(merged.values()),
};

await writeFile(resolve(destination), JSON.stringify(result, null, 2));
process.stdout.write(`Merged ${result.entries.length} catalog records.\n`);
