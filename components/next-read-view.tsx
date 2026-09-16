'use client';

import { useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Ban,
  BookHeart,
  BookOpenCheck,
  Clock3,
  Compass,
  Flame,
  Sparkles,
  Tags,
  TextSearch,
} from 'lucide-react';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui/button';
import {
  availableGenres,
  genreLabel,
  genresForBook,
  isToRead,
} from '@/lib/book-features';
import { recommendBooks, surpriseBook } from '@/lib/recommendations';
import type {
  BookGenre,
  BookMetadataMap,
  BookRecord,
  BookRecommendation,
  ReadingContext,
  RecommendationFeedback,
  RecommendationFeedbackAction,
  SurpriseMode,
  TasteProfile,
} from '@/lib/types';

const initialContext: ReadingContext = {
  genre: 'any',
  length: 'any',
  discovery: 'balanced',
};

const surpriseModes: Array<{
  value: SurpriseMode;
  label: string;
  description: string;
  icon: typeof BookHeart;
}> = [
  {
    value: 'safe',
    label: 'Safe pick',
    description: 'Closest to what you already rate highly.',
    icon: BookHeart,
  },
  {
    value: 'hidden-gem',
    label: 'Hidden gem',
    description: 'Well matched, but little read and rarely surfaced.',
    icon: Flame,
  },
  {
    value: 'wildcard',
    label: 'Wildcard',
    description: 'Deliberately outside your usual shelf.',
    icon: Compass,
  },
];

export function NextReadView({
  books,
  metadata,
  profile,
  feedback,
  loading,
  onImport,
  onFeedback,
  onResetFeedback,
}: {
  books: BookRecord[];
  metadata: BookMetadataMap;
  profile: TasteProfile;
  feedback: RecommendationFeedback[];
  loading: boolean;
  onImport: () => void;
  onFeedback: (
    entry: RecommendationFeedback,
  ) => Promise<RecommendationFeedback[]>;
  onResetFeedback: () => Promise<void>;
}) {
  const [context, setContext] = useState<ReadingContext>(initialContext);
  const [recommendations, setRecommendations] = useState<BookRecommendation[]>(
    [],
  );
  const [surprise, setSurprise] = useState<BookRecommendation | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [runIndex, setRunIndex] = useState(0);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const toRead = useMemo(() => books.filter(isToRead), [books]);
  const genres = useMemo(
    () => availableGenres(toRead, metadata),
    [toRead, metadata],
  );

  if (loading) {
    return (
      <div className="mx-auto h-[620px] max-w-5xl animate-pulse rounded-sm bg-card" />
    );
  }

  if (toRead.length === 0) {
    return (
      <section className="mx-auto max-w-xl pt-10 text-center sm:pt-20">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-muted text-primary">
          <BookOpenCheck className="size-6" aria-hidden="true" />
        </span>
        <p className="mt-6 eyebrow">Your next chapter</p>
        <h1 className="editorial-title mt-2">What should I read?</h1>
        <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-muted-foreground">
          Import your Goodreads library and Next Chapter will choose from the
          books already waiting on your to-read shelf.
        </p>
        <Button className="mt-7 h-12 rounded-xl px-5" onClick={onImport}>
          Import Goodreads CSV
        </Button>
      </section>
    );
  }

  function reveal() {
    window.setTimeout(
      () =>
        resultsRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        }),
      40,
    );
  }

  function findNext(avoidCurrent = false) {
    setFeedbackMessage(null);
    const nextRun = runIndex + 1;
    const next = recommendBooks({
      books,
      profile,
      context,
      metadata,
      excludedIds: avoidCurrent ? history : [],
      feedback,
      runIndex: nextRun,
    });
    setRunIndex(nextRun);
    setRecommendations(next);
    setSurprise(null);
    setHistory((current) => [...current, ...next.map((item) => item.book.id)]);
    reveal();
  }

  function runSurprise(mode: SurpriseMode) {
    setFeedbackMessage(null);
    const nextRun = runIndex + 1;
    const result = surpriseBook({
      books,
      profile,
      mode,
      metadata,
      excludedIds: history,
      feedback,
      runIndex: nextRun,
    });
    setRunIndex(nextRun);
    setSurprise(result);
    setRecommendations([]);
    if (result) setHistory((current) => [...current, result.book.id]);
    reveal();
  }

  async function recordFeedback(
    book: BookRecord,
    action: RecommendationFeedbackAction,
  ) {
    const pageCount = book.pageCount ?? metadata[book.id]?.pageCount ?? null;
    const entry: RecommendationFeedback = {
      bookId: book.id,
      action,
      pageCount,
      createdAt: new Date().toISOString(),
    };
    setFeedbackBusy(true);
    try {
      const nextFeedback = await onFeedback(entry);
      const nextRun = runIndex + 1;
      const nextContext =
        action === 'too-long' && pageCount && pageCount > 250
          ? { ...context, length: 'short' as const }
          : context;
      const displayedIds = recommendations.length
        ? recommendations.map((item) => item.book.id)
        : surprise
          ? [surprise.book.id]
          : [];
      let next = recommendBooks({
        books,
        profile,
        context: nextContext,
        metadata,
        excludedIds: [...history, ...displayedIds],
        feedback: nextFeedback,
        runIndex: nextRun,
      });
      if (next.length === 0) {
        next = recommendBooks({
          books,
          profile,
          context: nextContext,
          metadata,
          excludedIds: displayedIds,
          feedback: nextFeedback,
          runIndex: nextRun,
        });
      }
      setContext(nextContext);
      setRunIndex(nextRun);
      setRecommendations(next);
      setSurprise(null);
      setHistory((current) => [
        ...current,
        ...next.map((item) => item.book.id),
      ]);
      setFeedbackMessage(
        action === 'not-now'
          ? 'Noted — this book will stay out of your next picks.'
          : action === 'too-long'
            ? 'Noted — the next shortlist favors shorter books.'
            : 'Noted — the next shortlist follows similar story patterns.',
      );
      reveal();
    } catch {
      setFeedbackMessage('That preference could not be saved. Try again.');
    } finally {
      setFeedbackBusy(false);
    }
  }

  async function resetFeedback() {
    setFeedbackBusy(true);
    try {
      await onResetFeedback();
      setFeedbackMessage('Quick feedback reset.');
    } finally {
      setFeedbackBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <section className="next-read-intro">
        <p className="eyebrow">Your next chapter</p>
        <h1 className="editorial-title mt-3">
          What should I <span className="text-primary">read?</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          A short path from an endless shelf to three books that fit right now.
        </p>
      </section>

      <section className="relative mt-8 border-y border-border py-6 sm:py-8">
        <div className="relative space-y-7">
          <FilterGroup
            label="Genre"
            icon={Tags}
            hint="From book catalog subjects"
          >
            <ChoiceChip
              selected={context.genre === 'any'}
              onClick={() =>
                setContext((current) => ({ ...current, genre: 'any' }))
              }
            >
              All genres
            </ChoiceChip>
            {genres.map((genre) => (
              <ChoiceChip
                key={genre.id}
                selected={context.genre === genre.id}
                onClick={() =>
                  setContext((current) => ({
                    ...current,
                    genre: genre.id as BookGenre,
                  }))
                }
              >
                {genre.label}
                <span className="ml-1 text-[0.7rem] opacity-55">
                  {genre.count}
                </span>
              </ChoiceChip>
            ))}
          </FilterGroup>
          {genres.length === 0 && (
            <p className="-mt-4 text-xs leading-5 text-muted-foreground">
              Add catalog details from the Data page to unlock genre filtering.
            </p>
          )}

          <div className="grid gap-7 border-t border-border pt-7 md:grid-cols-2">
            <FilterGroup label="Length" icon={Clock3}>
              {[
                ['any', 'Any'],
                ['short', '≤ 250 pages'],
                ['medium', '251–450'],
                ['long', '451+'],
              ].map(([value, label]) => (
                <ChoiceChip
                  key={value}
                  selected={context.length === value}
                  onClick={() =>
                    setContext((current) => ({
                      ...current,
                      length: value as ReadingContext['length'],
                    }))
                  }
                >
                  {label}
                </ChoiceChip>
              ))}
            </FilterGroup>

            <FilterGroup
              label="Discovery"
              icon={Compass}
              hint="How familiar should the pick feel?"
            >
              {[
                ['familiar', 'Familiar'],
                ['balanced', 'Balanced'],
                ['stretch', 'Stretch'],
              ].map(([value, label]) => (
                <ChoiceChip
                  key={value}
                  selected={context.discovery === value}
                  onClick={() =>
                    setContext((current) => ({
                      ...current,
                      discovery: value as ReadingContext['discovery'],
                    }))
                  }
                >
                  {label}
                </ChoiceChip>
              ))}
            </FilterGroup>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-xs leading-5 text-muted-foreground">
              Genre and length are strict filters. Series stay in reading order:
              only the next unread volume can be picked. Taste history,
              Goodreads average, and time on your shelf decide the ranking.
            </p>
            <Button
              size="lg"
              className="h-13 w-full rounded-2xl px-6 text-base sm:w-auto sm:min-w-52"
              disabled={toRead.length < 1}
              onClick={() => findNext(false)}
            >
              <Sparkles aria-hidden="true" />
              Find my next read
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <p className="eyebrow">No filters, one answer</p>
        <h2 className="mt-1 font-serif text-2xl tracking-[-0.03em]">
          Surprise me
        </h2>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {surpriseModes.map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => runSurprise(mode.value)}
                className="surprise-choice group min-h-32 border-t px-1 py-5 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/55 focus-visible:outline-none"
              >
                <Icon
                  className="surprise-icon size-5 text-primary"
                  aria-hidden="true"
                />
                <span className="surprise-label mt-4 block font-serif text-2xl">
                  {mode.label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {mode.description}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div ref={resultsRef} className="scroll-mt-24">
        {feedbackMessage && (
          <output className="mt-8 block rounded-xl border border-primary/25 bg-primary-muted/35 px-4 py-3 text-sm text-foreground">
            {feedbackMessage}
          </output>
        )}
        {recommendations.length > 0 && (
          <Results
            title={
              recommendations.length === 3
                ? 'Three good ways in'
                : recommendations.length === 2
                  ? 'Two good ways in'
                  : 'One good way in'
            }
            subtitle={
              recommendations.length === 3
                ? 'Ranked from your to-read shelf, with the strongest reason shown first.'
                : `Only ${recommendations.length === 1 ? 'one book matches' : 'two books match'} every filter you chose, so the constraint stays strict.`
            }
            recommendations={recommendations}
            metadata={metadata}
            onAgain={() => findNext(true)}
            onFeedback={recordFeedback}
            feedbackBusy={feedbackBusy}
            feedbackCount={feedback.length}
            onResetFeedback={resetFeedback}
          />
        )}
        {surprise && (
          <Results
            title="This one"
            subtitle="A single decision, made from the information in your Goodreads export."
            recommendations={[surprise]}
            metadata={metadata}
            onAgain={() => runSurprise('wildcard')}
            onFeedback={recordFeedback}
            feedbackBusy={feedbackBusy}
            feedbackCount={feedback.length}
            onResetFeedback={resetFeedback}
          />
        )}
        {recommendations.length === 0 && !surprise && history.length > 0 && (
          <p className="mt-8 border-t border-border py-5 text-sm text-muted-foreground">
            No books match those constraints yet. Try another genre or length,
            or update your Goodreads export.
          </p>
        )}
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  icon: Icon,
  hint,
  children,
}: {
  label: string;
  icon: typeof Sparkles;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold">{label}</h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">{children}</div>
    </div>
  );
}

function ChoiceChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`editorial-choice min-h-11 px-0.5 py-2 transition-colors focus-visible:ring-3 focus-visible:ring-ring/55 focus-visible:outline-none ${selected ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
    >
      {children}
    </button>
  );
}

function Results({
  title,
  subtitle,
  recommendations,
  metadata,
  onAgain,
  onFeedback,
  feedbackBusy,
  feedbackCount,
  onResetFeedback,
}: {
  title: string;
  subtitle: string;
  recommendations: BookRecommendation[];
  metadata: BookMetadataMap;
  onAgain: () => void;
  onFeedback: (
    book: BookRecord,
    action: RecommendationFeedbackAction,
  ) => Promise<void>;
  feedbackBusy: boolean;
  feedbackCount: number;
  onResetFeedback: () => Promise<void>;
}) {
  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your shortlist</p>
          <h2 className="mt-1 font-serif text-4xl tracking-[-0.045em]">
            {title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {feedbackCount > 0 && (
            <Button
              variant="ghost"
              className="h-10 rounded-xl"
              disabled={feedbackBusy}
              onClick={() => void onResetFeedback()}
            >
              Reset feedback
            </Button>
          )}
          <Button
            variant="ghost"
            className="h-10 rounded-xl"
            disabled={feedbackBusy}
            onClick={onAgain}
          >
            Give me another set
          </Button>
        </div>
      </div>
      <div
        className={`mt-6 grid gap-4 ${recommendations.length > 1 ? 'md:grid-cols-3' : 'mx-auto max-w-md'}`}
      >
        {recommendations.map((recommendation, index) => (
          <RecommendationCard
            key={recommendation.book.id}
            recommendation={recommendation}
            metadata={metadata}
            index={index}
            onFeedback={onFeedback}
            feedbackBusy={feedbackBusy}
          />
        ))}
      </div>
    </section>
  );
}

function RecommendationCard({
  recommendation,
  metadata,
  index,
  onFeedback,
  feedbackBusy,
}: {
  recommendation: BookRecommendation;
  metadata: BookMetadataMap;
  index: number;
  onFeedback: (
    book: BookRecord,
    action: RecommendationFeedbackAction,
  ) => Promise<void>;
  feedbackBusy: boolean;
}) {
  const { book, reasons, score } = recommendation;
  const details = metadata[book.id];
  const pageCount = book.pageCount ?? details?.pageCount;
  const publicationYear =
    book.originalPublicationYear ??
    book.yearPublished ??
    details?.firstPublishYear;
  const genres = genresForBook(book, metadata).slice(0, 2);
  return (
    <article className="group overflow-hidden border-b border-border pb-4">
      <div className="grid grid-cols-[7.5rem_1fr] gap-4 md:block">
        <BookCover
          title={book.title}
          author={book.author}
          coverUrl={details?.coverUrl}
          className="md:mx-auto md:max-w-[13rem]"
        />
        <div className="min-w-0 md:mt-5">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>Pick {index + 1}</span>
            <span className="rounded-full bg-primary-muted px-2 py-1 font-semibold text-primary">
              {Math.round(score.total * 100)}% fit
            </span>
          </div>
          <h3 className="mt-3 text-lg leading-5 font-semibold tracking-[-0.03em]">
            {book.title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{book.author}</p>
          {genres.length > 0 && (
            <p className="mt-2 text-[0.7rem] leading-5 text-primary">
              {genres.map(genreLabel).join(' · ')}
            </p>
          )}
          <p className="mt-3 line-clamp-4 text-xs leading-5 text-muted-foreground">
            {details?.synopsis ??
              (details
                ? 'No catalog synopsis is available for this book yet.'
                : 'Add catalog details from the Data page to show a short synopsis.')}
          </p>
          <ul className="mt-4 space-y-2 text-xs leading-5 text-muted-foreground">
            {reasons.map((reason) => (
              <li key={reason} className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
                {reason}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {pageCount && <span>{pageCount.toLocaleString()} pages</span>}
            {book.averageRating && (
              <span>★ {book.averageRating.toFixed(2)}</span>
            )}
            {publicationYear && <span>{publicationYear}</span>}
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <p className="eyebrow">Tune your next picks</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg px-2 text-[0.7rem]"
                disabled={feedbackBusy}
                onClick={() => void onFeedback(book, 'not-now')}
              >
                <Ban className="size-3" /> Not now
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg px-2 text-[0.7rem]"
                disabled={feedbackBusy}
                onClick={() => void onFeedback(book, 'too-long')}
              >
                <TextSearch className="size-3" /> Too long
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg px-2 text-[0.7rem]"
                disabled={feedbackBusy}
                onClick={() => void onFeedback(book, 'more-like-this')}
              >
                <BookHeart className="size-3" /> More like this
              </Button>
            </div>
          </div>
          {book.goodreadsId && (
            <a
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              href={`https://www.goodreads.com/book/show/${book.goodreadsId}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Goodreads{' '}
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </a>
          )}
          {details?.sourceUrl && (
            <a
              className="mt-3 ml-3 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary hover:underline"
              href={details.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Library{' '}
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
