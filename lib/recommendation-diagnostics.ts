import { tasteFit } from '@/lib/recommendations';
import type {
  BookMetadataMap,
  BookRecord,
  RecommendationFeedback,
  TasteProfile,
} from '@/lib/types';

// Below this many entries in either bucket, an average is too noisy to show
// as a claim about whether the scoring tracks real choices.
const MINIMUM_SAMPLES_PER_BUCKET = 4;

export interface FeedbackAlignment {
  likedAverage: number;
  likedCount: number;
  passedAverage: number;
  passedCount: number;
  aligned: boolean;
}

/**
 * Checks whether the current taste model actually rates "more-like-this"
 * books higher than the ones a reader dismissed, using the feedback the app
 * already collects. This does not replay the historical recommendation
 * context (none is stored) — it re-scores every book against the taste
 * profile as it stands today.
 */
export function feedbackAlignment({
  feedback,
  books,
  profile,
  metadata,
}: {
  feedback: RecommendationFeedback[];
  books: BookRecord[];
  profile: TasteProfile;
  metadata: BookMetadataMap;
}): FeedbackAlignment | null {
  const byId = new Map(books.map((book) => [book.id, book]));
  const likedScores: number[] = [];
  const passedScores: number[] = [];

  for (const entry of feedback) {
    const book = byId.get(entry.bookId);
    if (!book) continue;
    const score = tasteFit(book, profile, metadata).score;
    if (entry.action === 'more-like-this') likedScores.push(score);
    else passedScores.push(score);
  }

  if (
    likedScores.length < MINIMUM_SAMPLES_PER_BUCKET ||
    passedScores.length < MINIMUM_SAMPLES_PER_BUCKET
  ) {
    return null;
  }

  const average = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const likedAverage = average(likedScores);
  const passedAverage = average(passedScores);

  return {
    likedAverage,
    likedCount: likedScores.length,
    passedAverage,
    passedCount: passedScores.length,
    aligned: likedAverage > passedAverage,
  };
}
