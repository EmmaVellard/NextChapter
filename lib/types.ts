export type ExclusiveShelf = string;

export interface BookRecord {
  id: string;
  goodreadsId: string | null;
  title: string;
  author: string;
  additionalAuthors: string[];
  isbn: string | null;
  isbn13: string | null;
  myRating: number | null;
  averageRating: number | null;
  publisher: string | null;
  binding: string | null;
  pageCount: number | null;
  yearPublished: number | null;
  originalPublicationYear: number | null;
  dateRead: string | null;
  dateAdded: string | null;
  bookshelves: string[];
  exclusiveShelf: ExclusiveShelf;
  myReview: string | null;
  readCount: number;
  ownedCopies: number;
}

export type BookMetadataStatus = 'matched' | 'not-found' | 'error';

export interface BookMetadata {
  bookId: string;
  status: BookMetadataStatus;
  provider: 'open-library' | 'google-books' | 'manual';
  providerKey: string | null;
  sourceUrl: string | null;
  coverUrl: string | null;
  subtitle: string | null;
  synopsis: string | null;
  subjects: string[];
  publishers: string[];
  firstPublishYear: number | null;
  pageCount: number | null;
  fetchedAt: string;
  seriesName?: string | null;
  seriesPosition?: number | null;
  manualEditedAt?: string | null;
}

export type BookMetadataMap = Record<string, BookMetadata>;

export interface LibrarySnapshot {
  books: BookRecord[];
  bookMetadata: BookMetadataMap;
  rankingOrder: string[];
  recommendationFeedback: RecommendationFeedback[];
  importedAt: string | null;
  sourceFileName: string | null;
}

export type RecommendationFeedbackAction =
  | 'not-now'
  | 'too-long'
  | 'more-like-this';

export interface RecommendationFeedback {
  bookId: string;
  action: RecommendationFeedbackAction;
  pageCount: number | null;
  createdAt: string;
}

export interface ImportSummary {
  parsedRows: number;
  importedBooks: number;
  skippedRows: number;
  warnings: string[];
  fileName: string;
  importedAt: string;
}

export interface BackupDescription {
  books: number;
  createdAt: string | null;
  sourceFileName: string | null;
}

export interface PreparedImport {
  result: GoodreadsParseResult;
  fileName: string;
  /** Books already saved, so a warning can state what would be discarded. */
  existingCount: number;
  existingFileName: string | null;
}

export interface GoodreadsParseResult {
  books: BookRecord[];
  parsedRows: number;
  skippedRows: number;
  warnings: string[];
}

export type TasteDimension = 'story' | 'genre' | 'author' | 'decade' | 'length';

export interface TasteSignal {
  dimension: TasteDimension;
  value: string;
  sampleSize: number;
  average: number;
  delta: number;
  confidence: number;
}

export interface NarrativeInsight {
  label: string;
  strength: 'Core pull' | 'Strong pull' | 'Supporting pull';
  description: string;
}

export interface StoryBalanceInsight {
  title: string;
  description: string;
}

export interface TasteProfile {
  overallAverage: number | null;
  ratedBookCount: number;
  signals: TasteSignal[];
  strongest: TasteSignal[];
  weakest: TasteSignal[];
  favoriteAuthors: TasteSignal[];
  favoriteGenres: TasteSignal[];
  favoriteStoryTypes: TasteSignal[];
  readerSummary: string;
  idealStory: string;
  narrativeInsights: NarrativeInsight[];
  storyBalance: StoryBalanceInsight[];
  lessCompelling: string | null;
}

export type BookGenre =
  | 'fantasy'
  | 'science-fiction'
  | 'mystery-thriller'
  | 'romance'
  | 'history-historical'
  | 'literary'
  | 'nonfiction'
  | 'memoir-biography'
  | 'horror'
  | 'young-adult'
  | 'adventure';
export type LengthPreference = 'any' | 'short' | 'medium' | 'long';
export type DiscoveryPreference = 'familiar' | 'balanced' | 'stretch';

export interface ReadingContext {
  genre: BookGenre | 'any';
  length: LengthPreference;
  discovery: DiscoveryPreference;
}

export interface RecommendationScore {
  total: number;
  taste: number;
  context: number;
  community: number;
  backlog: number;
}

export interface BookRecommendation {
  book: BookRecord;
  score: RecommendationScore;
  reasons: string[];
}

export type SurpriseMode = 'safe' | 'hidden-gem' | 'wildcard';

export interface BackupSnapshot {
  format: 'next-chapter-backup' | 'book-companion-backup';
  version: 2;
  createdAt: string;
  snapshot: LibrarySnapshot;
}

export interface MetadataProgress {
  completed: number;
  total: number;
  matched: number;
  notFound: number;
  errors: number;
}

export interface MetadataCacheSnapshot {
  format: 'next-chapter-metadata' | 'book-companion-metadata';
  version: 1;
  createdAt: string;
  entries: BookMetadata[];
}

export interface MetadataImportSummary {
  imported: number;
  skipped: number;
  preservedManual: number;
}

export interface YearSummary {
  year: number;
  booksRead: number;
  ratedCount: number;
  averageRating: number | null;
  fiveStarCount: number;
  totalPages: number;
  pageCountCoverage: number;
  topAuthors: Array<{ value: string; count: number }>;
  topGenres: Array<{ value: BookGenre; count: number }>;
  longestBook: BookRecord | null;
  books: BookRecord[];
}
