import { genreLabel, genresForBook, isToRead } from '@/lib/book-features';
import { featuresForBook } from '@/lib/taste-profile';
import { seriesRecommendationStatus } from '@/lib/series';
import type {
  BookMetadataMap,
  BookRecord,
  BookRecommendation,
  ReadingContext,
  RecommendationFeedback,
  SurpriseMode,
  TasteProfile,
  TasteSignal,
} from '@/lib/types';

function feedbackAffinity(
  book: BookRecord,
  feedback: RecommendationFeedback[],
  allBooks: BookRecord[],
  metadata: BookMetadataMap,
) {
  const seeds = feedback
    .filter((entry) => entry.action === 'more-like-this')
    .slice(-5)
    .map((entry) => allBooks.find((item) => item.id === entry.bookId))
    .filter((item): item is BookRecord => Boolean(item));
  if (seeds.length === 0) return { boost: 0, reason: null };

  const candidateFeatures = featuresForBook(book, metadata);
  let bestBoost = 0;
  let bestStory: string | null = null;
  for (const seed of seeds) {
    const seedFeatures = new Set(
      featuresForBook(seed, metadata).map(
        (feature) => `${feature.dimension}:${feature.value.toLowerCase()}`,
      ),
    );
    const shared = candidateFeatures.filter((feature) =>
      seedFeatures.has(`${feature.dimension}:${feature.value.toLowerCase()}`),
    );
    const story = shared.find((feature) => feature.dimension === 'story');
    const boost = Math.min(
      0.14,
      shared.reduce(
        (sum, feature) =>
          sum +
          (feature.dimension === 'story'
            ? 0.08
            : feature.dimension === 'author'
              ? 0.07
              : feature.dimension === 'genre'
                ? 0.035
                : 0),
        0,
      ),
    );
    if (boost > bestBoost) {
      bestBoost = boost;
      bestStory = story?.value ?? null;
    }
  }
  return {
    boost: bestBoost,
    reason: bestStory
      ? `More of the ${bestStory.toLowerCase()} story shape you asked for`
      : bestBoost > 0
        ? 'Similar to a book you wanted more of'
        : null,
  };
}

function deterministicNoise(value: string, runIndex: number) {
  let hash = 0;
  for (const char of `${value}:${runIndex}`)
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return ((Math.abs(hash) % 1000) / 1000 - 0.5) * 0.012;
}

function passesLength(
  book: BookRecord,
  context: ReadingContext,
  metadata: BookMetadataMap,
) {
  const pages = book.pageCount ?? metadata[book.id]?.pageCount;
  if (context.length !== 'any' && !pages) return false;
  if (context.length === 'short' && pages && pages > 250) return false;
  if (context.length === 'medium' && pages && (pages < 251 || pages > 450))
    return false;
  if (context.length === 'long' && pages && pages < 451) return false;
  return true;
}

function genreFit(
  book: BookRecord,
  context: ReadingContext,
  metadata: BookMetadataMap,
) {
  if (context.genre === 'any') return 0.55;
  return genresForBook(book, metadata).includes(context.genre) ? 1 : null;
}

function tasteFit(
  book: BookRecord,
  profile: TasteProfile,
  metadata: BookMetadataMap,
) {
  const matching = new Map<string, TasteSignal>();
  for (const signal of profile.signals) {
    matching.set(`${signal.dimension}:${signal.value.toLowerCase()}`, signal);
  }
  const signals = featuresForBook(book, metadata)
    .map((feature) =>
      matching.get(`${feature.dimension}:${feature.value.toLowerCase()}`),
    )
    .filter((signal): signal is TasteSignal => Boolean(signal));
  if (signals.length === 0) return { score: 0.5, best: null };

  const weighted =
    signals.reduce((sum, signal) => sum + signal.delta, 0) /
    Math.sqrt(signals.length);
  const best = [...signals].sort((a, b) => b.delta - a.delta)[0] ?? null;
  return { score: Math.max(0, Math.min(1, 0.5 + weighted / 1.35)), best };
}

function backlogFit(book: BookRecord) {
  if (!book.dateAdded) return 0.35;
  const addedAt = new Date(`${book.dateAdded}T00:00:00`).getTime();
  if (Number.isNaN(addedAt)) return 0.35;
  const ageInYears = (Date.now() - addedAt) / (365.25 * 24 * 60 * 60 * 1000);
  return Math.max(0, Math.min(1, ageInYears / 5));
}

function discoveryFit(tasteScore: number, context: ReadingContext) {
  if (context.discovery === 'familiar') return tasteScore;
  if (context.discovery === 'stretch') {
    return Math.max(0, 1 - Math.abs(tasteScore - 0.5) * 2);
  }
  return 0.62;
}

function recommendationFor(
  book: BookRecord,
  profile: TasteProfile,
  context: ReadingContext,
  metadata: BookMetadataMap,
  allBooks: BookRecord[],
  feedback: RecommendationFeedback[],
  runIndex: number,
): BookRecommendation | null {
  if (!passesLength(book, context, metadata)) return null;
  const seriesStatus = seriesRecommendationStatus(book, allBooks, metadata);
  if (!seriesStatus.eligible) return null;
  const genre = genreFit(book, context, metadata);
  if (genre === null) return null;

  const taste = tasteFit(book, profile, metadata);
  const discovery = discoveryFit(taste.score, context);
  const community = book.averageRating
    ? Math.max(0, Math.min(1, (book.averageRating - 3.2) / 1.4))
    : 0.5;
  const backlog = backlogFit(book);
  const feedbackMatch = feedbackAffinity(book, feedback, allBooks, metadata);
  const weights =
    context.discovery === 'familiar'
      ? {
          taste: 0.62,
          discovery: 0.04,
          genre: 0.17,
          community: 0.12,
          backlog: 0.05,
        }
      : context.discovery === 'stretch'
        ? {
            taste: 0.18,
            discovery: 0.34,
            genre: 0.2,
            community: 0.2,
            backlog: 0.08,
          }
        : {
            taste: 0.5,
            discovery: 0.05,
            genre: 0.19,
            community: 0.18,
            backlog: 0.08,
          };
  const total = Math.max(
    0,
    Math.min(
      1,
      taste.score * weights.taste +
        discovery * weights.discovery +
        genre * weights.genre +
        community * weights.community +
        backlog * weights.backlog +
        feedbackMatch.boost +
        deterministicNoise(book.id, runIndex),
    ),
  );
  const reasons: string[] = [];

  if (
    seriesStatus.series &&
    seriesStatus.series.position > 1 &&
    seriesStatus.highestFinished !== null
  ) {
    reasons.push(
      `Next eligible ${seriesStatus.series.name} volume after ${seriesStatus.highestFinished}`,
    );
  }

  if (feedbackMatch.reason) reasons.push(feedbackMatch.reason);

  if (context.genre !== 'any') {
    reasons.push(
      `Matches ${genreLabel(context.genre)} in its catalog subjects`,
    );
  }
  if (taste.best?.delta && taste.best.delta > 0.04) {
    if (taste.best.dimension === 'author') {
      reasons.push(`You tend to rate ${book.author} above your average`);
    } else if (taste.best.dimension === 'genre') {
      reasons.push(`You tend to rate ${taste.best.value} above your average`);
    } else {
      reasons.push(`${taste.best.value} books tend to work for you`);
    }
  }
  if (context.discovery === 'stretch' && Math.abs(taste.score - 0.5) < 0.12) {
    reasons.push('A less familiar lane without a negative taste signal');
  }
  const pageCount = book.pageCount ?? metadata[book.id]?.pageCount;
  if (context.length !== 'any' && pageCount) {
    reasons.push(
      `${pageCount.toLocaleString()} pages fits the length you chose`,
    );
  }
  if (backlog >= 0.55 && book.dateAdded) {
    reasons.push(`Waiting on your shelf since ${book.dateAdded.slice(0, 4)}`);
  }
  if (book.averageRating && book.averageRating >= 4) {
    reasons.push(`${book.averageRating.toFixed(2)} average Goodreads rating`);
  }
  if (reasons.length === 0)
    reasons.push('A balanced pick from your to-read shelf');

  return {
    book,
    score: {
      total,
      taste: taste.score,
      context: genre,
      community,
      backlog,
    },
    reasons: reasons.slice(0, 2),
  };
}

export function recommendBooks({
  books,
  profile,
  context,
  metadata = {},
  excludedIds = [],
  feedback = [],
  runIndex = 0,
  limit = 3,
}: {
  books: BookRecord[];
  profile: TasteProfile;
  context: ReadingContext;
  metadata?: BookMetadataMap;
  excludedIds?: string[];
  feedback?: RecommendationFeedback[];
  runIndex?: number;
  limit?: number;
}) {
  const excluded = new Set(excludedIds);
  for (const entry of feedback) {
    if (entry.action !== 'more-like-this') excluded.add(entry.bookId);
  }
  const tooLongLimit = [...feedback]
    .reverse()
    .find(
      (entry) => entry.action === 'too-long' && entry.pageCount !== null,
    )?.pageCount;
  const candidates = books
    .filter((book) => {
      if (!isToRead(book) || excluded.has(book.id)) return false;
      if (context.length !== 'any' || !tooLongLimit) return true;
      const pages = book.pageCount ?? metadata[book.id]?.pageCount;
      return Boolean(pages && pages < tooLongLimit);
    })
    .map((book) =>
      recommendationFor(
        book,
        profile,
        context,
        metadata,
        books,
        feedback,
        runIndex,
      ),
    )
    .filter((result): result is BookRecommendation => Boolean(result))
    .sort((a, b) => b.score.total - a.score.total);

  const selected: BookRecommendation[] = [];
  const authors = new Set<string>();
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (authors.has(candidate.book.author) && candidates.length > limit)
      continue;
    selected.push(candidate);
    authors.add(candidate.book.author);
  }
  return selected;
}

export function surpriseBook({
  books,
  profile,
  mode,
  metadata = {},
  excludedIds = [],
  feedback = [],
  runIndex = 0,
}: {
  books: BookRecord[];
  profile: TasteProfile;
  mode: SurpriseMode;
  metadata?: BookMetadataMap;
  excludedIds?: string[];
  feedback?: RecommendationFeedback[];
  runIndex?: number;
}) {
  const context: ReadingContext = {
    genre: 'any',
    length: 'any',
    discovery:
      mode === 'safe'
        ? 'familiar'
        : mode === 'wildcard'
          ? 'stretch'
          : 'balanced',
  };
  const recommendations = recommendBooks({
    books,
    profile,
    context,
    metadata,
    excludedIds,
    feedback,
    runIndex,
    limit: Math.max(3, books.length),
  });
  if (recommendations.length === 0) return null;

  if (mode === 'safe') return recommendations[0];
  if (mode === 'hidden-gem') {
    return (
      recommendations
        .filter(
          (item) => item.score.taste >= 0.5 && item.score.community < 0.63,
        )
        .sort((a, b) => b.score.taste - a.score.taste)[0] ??
      recommendations[1] ??
      recommendations[0]
    );
  }
  return (
    recommendations
      .filter((item) => item.score.taste < 0.58 && item.score.community >= 0.5)
      .sort((a, b) => b.score.community - a.score.community)[0] ??
    recommendations[0]
  );
}
