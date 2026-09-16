'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, BookMarked, Search, Upload } from 'lucide-react';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui/button';
import { genreLabel, genresForBook, isToRead } from '@/lib/book-features';
import type { BookMetadataMap, BookRecord } from '@/lib/types';

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    date,
  );
}

export function LibraryView({
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
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'added' | 'title' | 'rating'>('added');
  const [visibleCount, setVisibleCount] = useState(48);
  const toRead = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return books
      .filter(isToRead)
      .filter((book) =>
        `${book.title} ${book.author}`.toLowerCase().includes(normalized),
      )
      .sort((a, b) => {
        if (sort === 'title') return a.title.localeCompare(b.title);
        if (sort === 'rating')
          return (b.averageRating ?? 0) - (a.averageRating ?? 0);
        return (b.dateAdded ?? '').localeCompare(a.dateAdded ?? '');
      });
  }, [books, query, sort]);
  const visibleBooks = toRead.slice(0, visibleCount);

  if (loading)
    return <div className="h-[560px] animate-pulse rounded-[2rem] bg-card" />;
  if (books.filter(isToRead).length === 0) {
    return (
      <section className="mx-auto max-w-xl pt-10 text-center sm:pt-20">
        <span className="mx-auto grid size-13 place-items-center rounded-2xl bg-primary-muted text-primary">
          <BookMarked className="size-5" />
        </span>
        <h1 className="editorial-title mt-5">
          Your to-read shelf
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          Import a Goodreads library with books on the to-read shelf.
        </p>
        <Button className="mt-6 h-12 rounded-xl px-5" onClick={onImport}>
          Import Goodreads CSV
        </Button>
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            Recommendation pool
          </p>
          <h1 className="editorial-title mt-2">
            To read
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            {books.filter(isToRead).length.toLocaleString()} books from your
            Goodreads shelf.
          </p>
        </div>
        <Button
          variant="outline"
          className="h-11 rounded-xl"
          onClick={onImport}
        >
          <Upload /> Update library
        </Button>
      </div>

      <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background/35 px-3">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Search books</span>
          <input
            className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title or author"
          />
        </label>
        <select
          aria-label="Sort books"
          className="h-11 rounded-xl border border-border bg-background/35 px-3 text-sm outline-none"
          value={sort}
          onChange={(event) => setSort(event.target.value as typeof sort)}
        >
          <option value="added">Recently added</option>
          <option value="title">Title</option>
          <option value="rating">Goodreads rating</option>
        </select>
      </div>

      {toRead.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No title or author matches “{query}”.
        </p>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleBooks.map((book) => {
            const details = metadata[book.id];
            const genres = genresForBook(book, metadata).slice(0, 2);
            const pageCount = book.pageCount ?? details?.pageCount;
            const publicationYear =
              book.originalPublicationYear ??
              book.yearPublished ??
              details?.firstPublishYear;
            const publisher = book.publisher ?? details?.publishers[0];
            return (
              <article
                key={book.id}
                className="grid grid-cols-[5.5rem_1fr] gap-4 rounded-2xl border border-border bg-card p-3"
              >
                <BookCover
                  title={book.title}
                  author={book.author}
                  coverUrl={details?.coverUrl}
                  className="rounded-r-lg"
                />
                <div className="min-w-0 py-1">
                  <h2 className="line-clamp-2 font-semibold leading-5 tracking-[-0.02em]">
                    {book.title}
                  </h2>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {book.author}
                  </p>
                  {genres.length > 0 && (
                    <p className="mt-2 line-clamp-1 text-[0.68rem] text-primary">
                      {genres.map(genreLabel).join(' · ')}
                    </p>
                  )}
                  <p className="mt-2 line-clamp-2 text-[0.7rem] leading-4 text-muted-foreground">
                    {details?.synopsis ??
                      (details
                        ? 'No catalog synopsis is available for this book yet.'
                        : 'Add catalog details to show a short synopsis.')}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[0.7rem] text-muted-foreground">
                    {pageCount && <span>{pageCount} pages</span>}
                    {book.averageRating && (
                      <span>★ {book.averageRating.toFixed(2)}</span>
                    )}
                    {publicationYear && <span>{publicationYear}</span>}
                  </div>
                  {publisher && (
                    <p className="mt-1 line-clamp-1 text-[0.68rem] text-muted-foreground">
                      {publisher}
                    </p>
                  )}
                  {book.dateAdded && (
                    <p className="mt-2 text-[0.68rem] text-muted-foreground">
                      Added {formatDate(book.dateAdded)}
                    </p>
                  )}
                  {book.goodreadsId && (
                    <a
                      className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      href={`https://www.goodreads.com/book/show/${book.goodreadsId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Goodreads <ArrowUpRight className="size-3" />
                    </a>
                  )}
                  {details?.sourceUrl && (
                    <a
                      className="mt-3 ml-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary hover:underline"
                      href={details.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Library <ArrowUpRight className="size-3" />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {visibleCount < toRead.length && (
        <div className="mt-6 text-center">
          <Button
            variant="outline"
            className="h-11 rounded-xl"
            onClick={() => setVisibleCount((count) => count + 48)}
          >
            Show more · {toRead.length - visibleCount} remaining
          </Button>
        </div>
      )}
    </section>
  );
}
