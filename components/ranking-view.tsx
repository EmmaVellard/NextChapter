'use client';

import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  RotateCcw,
  Star,
  Trophy,
  Upload,
} from 'lucide-react';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui/button';
import { genreLabel, genresForBook, isRead } from '@/lib/book-features';
import { rankReadBooks, readingYear } from '@/lib/book-ranking';
import type { BookMetadataMap, BookRecord } from '@/lib/types';

export function RankingView({
  books,
  metadata,
  rankingOrder,
  loading,
  onImport,
  onRankingOrderChange,
}: {
  books: BookRecord[];
  metadata: BookMetadataMap;
  rankingOrder: string[];
  loading: boolean;
  onImport: () => void;
  onRankingOrderChange: (ids: string[]) => Promise<void>;
}) {
  const [year, setYear] = useState<'all' | number>('all');
  const ranked = useMemo(
    () => rankReadBooks(books, rankingOrder),
    [books, rankingOrder],
  );
  const years = useMemo(
    () =>
      Array.from(
        new Set(
          books
            .filter(isRead)
            .map(readingYear)
            .filter((value): value is number => value !== null),
        ),
      ).sort((a, b) => b - a),
    [books],
  );
  const visible =
    year === 'all'
      ? ranked
      : ranked.filter((book) => readingYear(book) === year);
  const unrated = books.filter(
    (book) =>
      isRead(book) &&
      book.myRating === null &&
      (year === 'all' || readingYear(book) === year),
  ).length;

  async function move(bookId: string, direction: -1 | 1) {
    const visibleIndex = visible.findIndex((book) => book.id === bookId);
    const target = visible[visibleIndex + direction];
    if (!target) return;
    const fullOrder = ranked.map((book) => book.id);
    const currentIndex = fullOrder.indexOf(bookId);
    const targetIndex = fullOrder.indexOf(target.id);
    [fullOrder[currentIndex], fullOrder[targetIndex]] = [
      fullOrder[targetIndex],
      fullOrder[currentIndex],
    ];
    await onRankingOrderChange(fullOrder);
  }

  if (loading) {
    return (
      <div className="mx-auto h-[620px] max-w-5xl animate-pulse rounded-sm bg-card" />
    );
  }

  return (
    <section className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Personal leaderboard</p>
          <h1 className="editorial-title mt-2">Your book ranking</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Start with your ratings, then use the arrows to make the order your
            own. The Goodreads average only breaks ties in the default order.
          </p>
        </div>
        <Button
          variant="outline"
          className="h-11 rounded-xl"
          onClick={onImport}
        >
          <Upload /> Update ratings
        </Button>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-y border-border py-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Trophy className="size-4 text-primary" />
            {visible.length.toLocaleString()} ranked books
          </span>
          {rankingOrder.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 rounded-xl"
              onClick={() => onRankingOrderChange([])}
            >
              <RotateCcw className="size-3.5" /> Reset order
            </Button>
          )}
        </div>
        <label className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <span className="sr-only">Reading year</span>
          <select
            aria-label="Reading year"
            className="h-10 rounded-xl border border-border bg-background/40 px-3 text-sm outline-none"
            value={year}
            onChange={(event) =>
              setYear(
                event.target.value === 'all'
                  ? 'all'
                  : Number(event.target.value),
              )
            }
          >
            <option value="all">All years</option>
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="mt-4 border-t border-border py-6 text-sm text-muted-foreground">
          No rated finished books are available for this period. Add ratings in
          Goodreads and import a fresh export.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {visible.map((book, index) => {
            const genres = genresForBook(book, metadata).slice(0, 2);
            return (
              <article
                key={book.id}
                className="grid grid-cols-[2.5rem_3.5rem_minmax(0,1fr)] items-center gap-3 border-b border-border py-3 sm:grid-cols-[3rem_4rem_minmax(0,1fr)_auto] sm:gap-4"
              >
                <p className="text-center font-serif text-2xl text-primary">
                  {index + 1}
                </p>
                <BookCover
                  title={book.title}
                  author={book.author}
                  coverUrl={metadata[book.id]?.coverUrl}
                  className="rounded-r-md"
                />
                <div className="min-w-0">
                  <h2 className="line-clamp-1 font-semibold tracking-[-0.02em]">
                    {book.title}
                  </h2>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {book.author}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-primary">
                    <Star className="mr-1 inline size-3" /> {book.myRating}/5
                  </p>
                  {genres.length > 0 && (
                    <p className="mt-1 line-clamp-1 text-[0.68rem] text-muted-foreground">
                      {genres.map(genreLabel).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="col-start-3 flex items-center justify-between gap-2 text-xs text-muted-foreground sm:col-start-auto sm:justify-end sm:text-right">
                  <div>
                    {book.averageRating && (
                      <p>Goodreads {book.averageRating.toFixed(2)}</p>
                    )}
                    {book.dateRead && (
                      <p className="mt-1">Read {book.dateRead}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-xl"
                      disabled={index === 0}
                      aria-label={`Move ${book.title} up`}
                      onClick={() => move(book.id, -1)}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-xl"
                      disabled={index === visible.length - 1}
                      aria-label={`Move ${book.title} down`}
                      onClick={() => move(book.id, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {unrated > 0 && (
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          {unrated.toLocaleString()} finished{' '}
          {unrated === 1 ? 'book is' : 'books are'} not ranked because{' '}
          {unrated === 1 ? 'it has' : 'they have'} no personal rating.
        </p>
      )}
    </section>
  );
}
