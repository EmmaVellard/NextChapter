'use client';

import { useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  BookHeart,
  BookOpenCheck,
  Clock3,
  Compass,
  Feather,
  Flame,
  Sparkles,
  Tags,
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
  SurpriseMode,
  TasteProfile,
} from '@/lib/types';

const initialContext: ReadingContext = {
  genre: 'any',
  length: 'any',
  discovery: 'balanced',
};

export function NextReadView({
  books,
  metadata,
  profile,
  loading,
  onImport,
}: {
  books: BookRecord[];
  metadata: BookMetadataMap;
  profile: TasteProfile;
  loading: boolean;
  onImport: () => void;
}) {
  const [context, setContext] = useState<ReadingContext>(initialContext);
  const [recommendations, setRecommendations] = useState<BookRecommendation[]>(
    [],
  );
  const [surprise, setSurprise] = useState<BookRecommendation | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [runIndex, setRunIndex] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const toRead = useMemo(() => books.filter(isToRead), [books]);
  const genres = useMemo(
    () => availableGenres(toRead, metadata),
    [toRead, metadata],
  );

  if (loading) {
    return (
      <div className="mx-auto h-[620px] max-w-5xl animate-pulse rounded-[2rem] bg-card" />
    );
  }

  if (toRead.length === 0) {
    return (
      <section className="mx-auto max-w-xl pt-10 text-center sm:pt-20">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-muted text-primary">
          <BookOpenCheck className="size-6" aria-hidden="true" />
        </span>
        <p className="mt-6 text-xs font-semibold tracking-[0.16em] text-primary uppercase">
          Your next chapter
        </p>
        <h1 className="mt-2 font-serif text-5xl leading-none tracking-[-0.05em] sm:text-6xl">
          What should I read?
        </h1>
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
    const nextRun = runIndex + 1;
    const next = recommendBooks({
      books,
      profile,
      context,
      metadata,
      excludedIds: avoidCurrent ? history : [],
      runIndex: nextRun,
    });
    setRunIndex(nextRun);
    setRecommendations(next);
    setSurprise(null);
    setHistory((current) => [...current, ...next.map((item) => item.book.id)]);
    reveal();
  }

  function runSurprise(mode: SurpriseMode) {
    const nextRun = runIndex + 1;
    const result = surpriseBook({
      books,
      profile,
      mode,
      metadata,
      excludedIds: history,
      runIndex: nextRun,
    });
    setRunIndex(nextRun);
    setSurprise(result);
    setRecommendations([]);
    if (result) setHistory((current) => [...current, result.book.id]);
    reveal();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <section className="text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary-muted/70 px-3 py-1.5 text-xs font-semibold tracking-[0.13em] text-primary uppercase">
          <Feather className="size-3.5" aria-hidden="true" />
          Your next chapter
        </div>
        <h1 className="font-serif text-[clamp(3.3rem,9vw,6.7rem)] leading-[0.86] tracking-[-0.065em] text-balance">
          What should I read?
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
          A short path from an endless shelf to three books that fit right now.
        </p>
      </section>

      <section className="relative mt-9 overflow-hidden rounded-[2rem] border border-border bg-card/90 p-5 shadow-[0_30px_100px_rgba(0,0,0,0.28)] sm:p-7">
        <div className="pointer-events-none absolute inset-x-20 -top-32 h-56 rounded-full bg-primary/13 blur-3xl" />
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

      <section className="mt-4 rounded-[1.75rem] border border-border bg-card/55 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
              No filters, one answer
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em]">
              Surprise me
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={() => runSurprise('safe')}
            >
              <BookHeart /> Safe pick
            </Button>
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={() => runSurprise('hidden-gem')}
            >
              <Flame /> Hidden gem
            </Button>
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={() => runSurprise('wildcard')}
            >
              <Compass /> Wildcard
            </Button>
          </div>
        </div>
      </section>

      <div ref={resultsRef} className="scroll-mt-24">
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
          />
        )}
        {surprise && (
          <Results
            title="This one"
            subtitle="A single decision, made from the information in your Goodreads export."
            recommendations={[surprise]}
            metadata={metadata}
            onAgain={() => runSurprise('wildcard')}
          />
        )}
        {recommendations.length === 0 && !surprise && history.length > 0 && (
          <p className="mt-8 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
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
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
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
      className={`rounded-full border px-3.5 py-2 text-sm font-medium transition-all ${selected ? 'border-primary/55 bg-primary-muted text-primary' : 'border-border bg-background/35 text-muted-foreground hover:border-primary/35 hover:text-foreground'}`}
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
}: {
  title: string;
  subtitle: string;
  recommendations: BookRecommendation[];
  metadata: BookMetadataMap;
  onAgain: () => void;
}) {
  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.13em] text-primary uppercase">
            Your shortlist
          </p>
          <h2 className="mt-1 font-serif text-4xl tracking-[-0.045em]">
            {title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button variant="ghost" className="h-10 rounded-xl" onClick={onAgain}>
          Give me another set
        </Button>
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
}: {
  recommendation: BookRecommendation;
  metadata: BookMetadataMap;
  index: number;
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
    <article className="overflow-hidden rounded-[1.75rem] border border-border bg-card p-4">
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
