import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  Star,
  Upload,
} from 'lucide-react';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui/button';
import { genreLabel } from '@/lib/book-features';
import { buildYearSummaries, undatedReadCount } from '@/lib/year-summary';
import type { BookMetadataMap, BookRecord, YearSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

export function YearView({
  books,
  metadata,
  loading,
  onImport,
}: {
  books: BookRecord[];
  metadata: BookMetadataMap;
  loading: boolean;
  onImport: () => void;
}) {
  if (loading) {
    return (
      <div className="mx-auto h-[560px] max-w-5xl animate-pulse rounded-[2rem] bg-card" />
    );
  }

  const summaries = buildYearSummaries(books, metadata);
  const undated = undatedReadCount(books);
  if (summaries.length === 0) {
    return (
      <section className="mx-auto max-w-xl pt-10 text-center sm:pt-20">
        <span className="mx-auto grid size-13 place-items-center rounded-2xl bg-primary-muted text-primary">
          <CalendarDays className="size-5" />
        </span>
        <h1 className="mt-5 font-serif text-5xl tracking-[-0.05em]">
          Your reading years
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">
          Add “Date Read” values in Goodreads, then import a fresh export to
          build year-by-year summaries.
        </p>
        <Button className="mt-6 h-12 rounded-xl px-5" onClick={onImport}>
          <Upload /> Update Goodreads data
        </Button>
      </section>
    );
  }

  const [latest, ...earlier] = summaries;
  return (
    <section className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            Reading history
          </p>
          <h1 className="mt-2 font-serif text-5xl tracking-[-0.055em] sm:text-6xl">
            Your years in books
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            A yearly view built from Goodreads “Date Read,” with ratings, pages,
            authors, and catalog genres kept in context.
          </p>
        </div>
        <Button
          variant="outline"
          className="h-11 rounded-xl"
          onClick={onImport}
        >
          <Upload /> Update dates
        </Button>
      </div>

      <YearCard summary={latest} metadata={metadata} featured />

      {earlier.length > 0 && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {earlier.map((summary) => (
            <YearCard
              key={summary.year}
              summary={summary}
              metadata={metadata}
            />
          ))}
        </div>
      )}

      {undated > 0 && (
        <p className="mt-4 rounded-2xl border border-border bg-card px-5 py-4 text-xs leading-5 text-muted-foreground">
          {undated.toLocaleString()} read{' '}
          {undated === 1 ? 'book has' : 'books have'} no “Date Read” in the
          export, so {undated === 1 ? 'it is' : 'they are'} not assigned to a
          year.
        </p>
      )}
    </section>
  );
}

function YearCard({
  summary,
  metadata,
  featured = false,
}: {
  summary: YearSummary;
  metadata: BookMetadataMap;
  featured?: boolean;
}) {
  const longest = summary.longestBook;
  const longestPages = longest
    ? (longest.pageCount ?? metadata[longest.id]?.pageCount)
    : null;
  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-[2rem] border bg-card p-6',
        featured ? 'mt-8 border-primary/25 sm:p-8' : 'border-border',
      )}
    >
      {featured && (
        <div className="pointer-events-none absolute -top-28 right-8 size-64 rounded-full bg-primary/12 blur-3xl" />
      )}
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.13em] text-primary uppercase">
            {featured ? 'Latest chapter' : 'Reading year'}
          </p>
          <h2 className="mt-1 font-serif text-6xl tracking-[-0.065em]">
            {summary.year}
          </h2>
        </div>
        <span className="grid size-11 place-items-center rounded-2xl bg-primary-muted text-primary">
          <CalendarDays className="size-5" />
        </span>
      </div>

      <div className="relative mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          value={summary.booksRead.toLocaleString()}
          label={summary.booksRead === 1 ? 'book finished' : 'books finished'}
        />
        <Metric
          value={
            summary.averageRating === null
              ? '—'
              : summary.averageRating.toFixed(2)
          }
          label={summary.ratedCount + ' rated'}
        />
        <Metric
          value={summary.totalPages.toLocaleString()}
          label={
            'pages · ' +
            summary.pageCountCoverage +
            '/' +
            summary.booksRead +
            ' books'
          }
        />
        <Metric
          value={summary.fiveStarCount.toLocaleString()}
          label="five-star reads"
        />
      </div>

      <div className="relative mt-6 grid gap-5 border-t border-border pt-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-foreground">Top genres</p>
          {summary.topGenres.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {summary.topGenres.map(({ value, count }) => (
                <span
                  key={value}
                  className="rounded-full border border-border bg-background/35 px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {genreLabel(value)} · {count}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Add catalog details to see genres.
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">Top authors</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {summary.topAuthors
              .map(({ value, count }) => value + ' · ' + count)
              .join('  ·  ')}
          </p>
        </div>
      </div>

      {longest && longestPages && (
        <div className="relative mt-6 grid grid-cols-[3.5rem_1fr] gap-3 rounded-2xl border border-border bg-background/30 p-3">
          <BookCover
            title={longest.title}
            author={longest.author}
            coverUrl={metadata[longest.id]?.coverUrl}
            className="rounded-r-md"
          />
          <div className="min-w-0 self-center">
            <p className="flex items-center gap-1 text-[0.68rem] font-semibold tracking-[0.1em] text-primary uppercase">
              <BookOpen className="size-3" /> Longest
            </p>
            <p className="mt-1 line-clamp-1 text-sm font-semibold">
              {longest.title}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {longestPages.toLocaleString()} pages
              {longest.myRating && (
                <>
                  {' '}
                  · <Star className="inline size-3" /> {longest.myRating}
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <details
        className="group relative mt-6 border-t border-border pt-5"
        open={featured}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl text-sm font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/55">
          <span>
            All {summary.books.length.toLocaleString()}{' '}
            {summary.books.length === 1 ? 'book' : 'books'} read in{' '}
            {summary.year}
          </span>
          <ChevronDown className="size-4 text-primary transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {summary.books.map((book) => (
            <div
              key={book.id}
              className="grid grid-cols-[2.75rem_1fr] gap-3 rounded-xl border border-border bg-background/28 p-2.5"
            >
              <BookCover
                title={book.title}
                author={book.author}
                coverUrl={metadata[book.id]?.coverUrl}
                className="rounded-r-sm"
              />
              <div className="min-w-0 self-center">
                <p className="line-clamp-1 text-xs font-semibold">
                  {book.title}
                </p>
                <p className="mt-1 line-clamp-1 text-[0.68rem] text-muted-foreground">
                  {book.author}
                </p>
                <p className="mt-1 text-[0.68rem] text-muted-foreground">
                  {book.dateRead}
                  {book.myRating && ` · ★ ${book.myRating}/5`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </details>
    </article>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/28 p-4">
      <p className="text-2xl font-semibold tracking-[-0.04em]">{value}</p>
      <p className="mt-1 text-[0.68rem] leading-4 text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
