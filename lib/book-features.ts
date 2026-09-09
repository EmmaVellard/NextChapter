import type {
  BookGenre,
  BookMetadata,
  BookMetadataMap,
  BookRecord,
} from '@/lib/types';

export const genreCatalog: Array<{
  id: BookGenre;
  label: string;
  aliases: string[];
}> = [
  {
    id: 'fantasy',
    label: 'Fantasy',
    aliases: [
      'fantasy',
      'high-fantasy',
      'urban-fantasy',
      'epic-fantasy',
      'magical-realism',
      'fantasy-fiction',
      'magic',
    ],
  },
  {
    id: 'science-fiction',
    label: 'Science fiction',
    aliases: [
      'science-fiction',
      'sci-fi',
      'scifi',
      'space-opera',
      'dystopian',
      'speculative-fiction',
      'science-fiction-fiction',
    ],
  },
  {
    id: 'mystery-thriller',
    label: 'Mystery & thriller',
    aliases: [
      'mystery',
      'mysteries',
      'thriller',
      'crime',
      'suspense',
      'detective',
    ],
  },
  {
    id: 'romance',
    label: 'Romance',
    aliases: ['romance', 'romantic', 'rom-com', 'love-stories'],
  },
  {
    id: 'history-historical',
    label: 'History & historical',
    aliases: ['history', 'historical', 'historical-fiction', 'world-history'],
  },
  {
    id: 'literary',
    label: 'Literary',
    aliases: [
      'literary',
      'literary-fiction',
      'classics',
      'classic',
      'fiction-literary',
    ],
  },
  {
    id: 'nonfiction',
    label: 'Nonfiction',
    aliases: [
      'nonfiction',
      'non-fiction',
      'essays',
      'science',
      'philosophy',
      'psychology',
      'politics',
      'economics',
      'social-science',
      'nature',
    ],
  },
  {
    id: 'memoir-biography',
    label: 'Memoir & biography',
    aliases: ['memoir', 'memoirs', 'biography', 'biographies', 'autobiography'],
  },
  { id: 'horror', label: 'Horror', aliases: ['horror', 'gothic'] },
  {
    id: 'young-adult',
    label: 'Young adult',
    aliases: [
      'young-adult',
      'ya',
      'middle-grade',
      'juvenile-fiction',
      'teenage-fiction',
    ],
  },
  {
    id: 'adventure',
    label: 'Adventure',
    aliases: ['adventure', 'travel', 'quest'],
  },
];

export const storyTraitCatalog = [
  {
    label: 'Epic & sweeping',
    aliases: ['epic', 'saga', 'quest', 'quests'],
  },
  {
    label: 'Dark & intense',
    aliases: ['dark-fantasy', 'horror', 'revenge', 'violence', 'dystopian'],
  },
  {
    label: 'Romantic',
    aliases: ['romance', 'love-stories', 'romantic', 'man-woman-relationships'],
  },
  {
    label: 'Mystery-led',
    aliases: ['mystery', 'detective', 'thriller', 'crime', 'suspense'],
  },
  {
    label: 'Adventure-led',
    aliases: ['adventure', 'voyages', 'exploration', 'survival'],
  },
  {
    label: 'Mythic & folkloric',
    aliases: ['mythology', 'folklore', 'legends', 'fairy-tales', 'myths'],
  },
  {
    label: 'Coming-of-age',
    aliases: ['coming-of-age', 'bildungsromans', 'teenagers', 'young-adult'],
  },
  {
    label: 'Historical',
    aliases: ['historical-fiction', 'history', 'middle-ages', 'world-war'],
  },
  {
    label: 'Speculative & futuristic',
    aliases: [
      'science-fiction',
      'space',
      'time-travel',
      'future',
      'dystopian',
      'robots',
    ],
  },
  {
    label: 'Political & social',
    aliases: [
      'politics',
      'political',
      'social-conditions',
      'social-classes',
      'revolutions',
    ],
  },
  {
    label: 'Family & relationships',
    aliases: [
      'families',
      'family',
      'friendship',
      'friendships',
      'interpersonal-relations',
    ],
  },
  {
    label: 'Humorous',
    aliases: ['humor', 'humorous-stories', 'wit-and-humor', 'comedy'],
  },
] as const;

export const reservedShelves = new Set([
  'read',
  'to-read',
  'currently-reading',
  'owned',
  'default',
]);

export function publicationYear(book: BookRecord) {
  return book.originalPublicationYear ?? book.yearPublished;
}

export function decadeFor(book: BookRecord) {
  const year = publicationYear(book);
  return year ? `${Math.floor(year / 10) * 10}s` : null;
}

export function lengthBand(pageCount: number | null) {
  if (!pageCount) return null;
  if (pageCount < 250) return 'Under 250 pages';
  if (pageCount < 400) return '250–399 pages';
  if (pageCount < 600) return '400–599 pages';
  return '600+ pages';
}

export function customShelves(book: BookRecord) {
  return book.bookshelves.filter((shelf) => !reservedShelves.has(shelf));
}

function valueMatchesAlias(shelf: string, alias: string) {
  if (alias.length <= 2) return shelf === alias;
  return (
    shelf === alias ||
    shelf.startsWith(`${alias}-`) ||
    shelf.endsWith(`-${alias}`) ||
    shelf.includes(`-${alias}-`)
  );
}

function normalizeGenreValue(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function metadataForBook(
  book: BookRecord,
  metadata: BookMetadataMap,
): BookMetadata | null {
  return metadata[book.id] ?? null;
}

export function genresForBook(
  book: BookRecord,
  metadata: BookMetadataMap = {},
): BookGenre[] {
  const values = [
    ...customShelves(book),
    ...(metadata[book.id]?.subjects ?? []),
  ].map(normalizeGenreValue);
  return genreCatalog
    .filter((genre) =>
      values.some((value) =>
        genre.aliases.some((alias) =>
          valueMatchesAlias(value, normalizeGenreValue(alias)),
        ),
      ),
    )
    .map((genre) => genre.id);
}

export function availableGenres(
  books: BookRecord[],
  metadata: BookMetadataMap = {},
) {
  const counts = new Map<BookGenre, number>();
  for (const book of books) {
    for (const genre of genresForBook(book, metadata)) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  return genreCatalog
    .filter((genre) => counts.has(genre.id))
    .map((genre) => ({ ...genre, count: counts.get(genre.id) ?? 0 }));
}

export function storyTraitsForBook(
  book: BookRecord,
  metadata: BookMetadataMap = {},
) {
  const values = [
    ...customShelves(book),
    ...(metadata[book.id]?.subjects ?? []),
  ].map(normalizeGenreValue);
  return storyTraitCatalog
    .filter((trait) =>
      values.some((value) =>
        trait.aliases.some((alias) =>
          valueMatchesAlias(value, normalizeGenreValue(alias)),
        ),
      ),
    )
    .map((trait) => trait.label);
}

export function genreLabel(genre: BookGenre) {
  return genreCatalog.find((item) => item.id === genre)?.label ?? genre;
}

export function isRead(book: BookRecord) {
  return book.exclusiveShelf === 'read';
}

export function isToRead(book: BookRecord) {
  return (
    book.exclusiveShelf === 'to-read' || book.bookshelves.includes('to-read')
  );
}

export function isCurrentlyReading(book: BookRecord) {
  return book.exclusiveShelf === 'currently-reading';
}

export function formatShelf(shelf: string) {
  return shelf
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
