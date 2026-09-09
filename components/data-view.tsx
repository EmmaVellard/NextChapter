'use client';

import { useMemo, useRef, useState } from 'react';
import {
  BookCheck,
  BookMarked,
  Download,
  ExternalLink,
  HardDrive,
  LockKeyhole,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MetadataEditor } from '@/components/metadata-editor';
import { isCurrentlyReading, isRead, isToRead } from '@/lib/book-features';
import { findBookMetadata } from '@/lib/open-library';
import type {
  BookMetadata,
  LibrarySnapshot,
  MetadataImportSummary,
} from '@/lib/types';

function formatDate(value: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}

function mergeOnlineMetadata(
  current: BookMetadata | undefined,
  found: BookMetadata,
) {
  if (!current || current.provider !== 'manual') return found;
  return {
    ...found,
    provider: 'manual' as const,
    providerKey: current.providerKey ?? found.providerKey,
    sourceUrl: current.sourceUrl ?? found.sourceUrl,
    coverUrl: current.coverUrl ?? found.coverUrl,
    subtitle: current.subtitle ?? found.subtitle,
    synopsis: current.synopsis ?? found.synopsis,
    subjects: current.subjects.length > 0 ? current.subjects : found.subjects,
    publishers:
      current.publishers.length > 0 ? current.publishers : found.publishers,
    firstPublishYear: current.firstPublishYear ?? found.firstPublishYear,
    pageCount: current.pageCount ?? found.pageCount,
    seriesName: current.seriesName ?? found.seriesName,
    seriesPosition: current.seriesPosition ?? found.seriesPosition,
    manualEditedAt: current.manualEditedAt,
  };
}

export function DataView({
  snapshot,
  loading,
  onImport,
  onDownloadBackup,
  onRestoreBackup,
  onImportMetadata,
  onSaveMetadata,
  onClear,
}: {
  snapshot: LibrarySnapshot;
  loading: boolean;
  onImport: () => void;
  onDownloadBackup: () => Promise<void>;
  onRestoreBackup: (file: File) => Promise<void>;
  onImportMetadata: (file: File) => Promise<MetadataImportSummary>;
  onSaveMetadata: (entry: BookMetadata) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const restoreRef = useRef<HTMLInputElement>(null);
  const metadataRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<
    'backup' | 'restore' | 'metadata-import' | 'clear' | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lookupBookId, setLookupBookId] = useState<string | null>(null);
  const [correctionQuery, setCorrectionQuery] = useState('');
  const [editingBook, setEditingBook] = useState<
    (typeof snapshot.books)[number] | null
  >(null);
  const books = snapshot.books;
  const metadataEntries = Object.values(snapshot.bookMetadata);
  const matchedMetadata = metadataEntries.filter(
    (entry) => entry.status === 'matched',
  ).length;
  const completedMetadata = metadataEntries.filter(
    (entry) => entry.status !== 'error',
  ).length;
  const booksWithIsbn = books.filter((book) => book.isbn13 || book.isbn);
  const completedIsbnMetadata = booksWithIsbn.filter(
    (book) =>
      snapshot.bookMetadata[book.id]?.status !== 'error' &&
      snapshot.bookMetadata[book.id],
  ).length;
  const metadataErrors = booksWithIsbn.filter(
    (book) => snapshot.bookMetadata[book.id]?.status === 'error',
  ).length;
  const incompleteBooks = useMemo(
    () =>
      books.filter((book) => {
        const details = snapshot.bookMetadata[book.id];
        return (
          !details?.coverUrl ||
          details.subjects.length === 0 ||
          !details.synopsis
        );
      }),
    [books, snapshot.bookMetadata],
  );
  const correctionBooks = useMemo(() => {
    const normalized = correctionQuery.trim().toLowerCase();
    const source = normalized ? books : incompleteBooks;
    return source
      .filter((book) =>
        `${book.title} ${book.author}`.toLowerCase().includes(normalized),
      )
      .slice(0, 8);
  }, [books, correctionQuery, incompleteBooks]);
  const metrics = [
    { label: 'Read', value: books.filter(isRead).length, icon: BookCheck },
    {
      label: 'To read',
      value: books.filter(isToRead).length,
      icon: BookMarked,
    },
    {
      label: 'Reading',
      value: books.filter(isCurrentlyReading).length,
      icon: RefreshCw,
    },
    {
      label: 'Rated',
      value: books.filter((book) => book.myRating !== null).length,
      icon: HardDrive,
    },
  ];

  async function download() {
    setBusy('backup');
    setMessage(null);
    try {
      await onDownloadBackup();
      setMessage('Backup downloaded.');
    } finally {
      setBusy(null);
    }
  }

  async function restore(file: File | undefined) {
    if (!file) return;
    setBusy('restore');
    setMessage(null);
    try {
      await onRestoreBackup(file);
      setMessage('Backup restored.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'The backup could not be restored.',
      );
    } finally {
      setBusy(null);
      if (restoreRef.current) restoreRef.current.value = '';
    }
  }

  async function clear() {
    setBusy('clear');
    setMessage(null);
    try {
      await onClear();
    } finally {
      setBusy(null);
    }
  }

  async function importMetadata(file: File | undefined) {
    if (!file) return;
    setBusy('metadata-import');
    setMessage(null);
    try {
      const result = await onImportMetadata(file);
      setMessage(
        `Added catalog details for ${result.imported.toLocaleString()} books${
          result.preservedManual > 0
            ? `; preserved ${result.preservedManual.toLocaleString()} manual corrections`
            : ''
        }${
          result.skipped > 0
            ? `; ${result.skipped.toLocaleString()} records did not belong to this library`
            : ''
        }.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'The catalog file could not be imported.',
      );
    } finally {
      setBusy(null);
      if (metadataRef.current) metadataRef.current.value = '';
    }
  }

  async function lookupBook(book: (typeof snapshot.books)[number]) {
    setLookupBookId(book.id);
    setMessage(null);
    const current = snapshot.bookMetadata[book.id];
    try {
      const found = await findBookMetadata(book);
      if (found.status !== 'matched') {
        setMessage(`No reliable online match was found for “${book.title}”.`);
        return;
      }
      const merged = mergeOnlineMetadata(current, found);
      const added = [
        !current?.coverUrl && merged.coverUrl && 'cover',
        !current?.synopsis && merged.synopsis && 'synopsis',
        (!current || current.subjects.length === 0) &&
          merged.subjects.length > 0 &&
          'story details',
      ].filter((value): value is string => typeof value === 'string');
      await onSaveMetadata(merged);
      setMessage(
        added.length > 0
          ? `Found ${added.join(', ')} for “${book.title}”.`
          : `Checked “${book.title}”; its saved details are already the best match.`,
      );
    } catch {
      setMessage(
        `Online search for “${book.title}” could not finish. Try again in a moment.`,
      );
    } finally {
      setLookupBookId(null);
    }
  }

  return (
    <section className="mx-auto max-w-4xl">
      <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
        Private by design
      </p>
      <h1 className="mt-2 font-serif text-5xl tracking-[-0.055em] sm:text-6xl">
        Your data
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
        Goodreads stays your source of truth. This app keeps a local reading
        copy and never changes your Goodreads account.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <article
            key={label}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <Icon className="size-4 text-primary" aria-hidden="true" />
            <p className="mt-5 text-2xl font-semibold tracking-[-0.04em]">
              {loading ? '—' : value.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </article>
        ))}
      </div>

      <article className="mt-4 rounded-[2rem] border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.13em] text-primary uppercase">
              Goodreads import
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em]">
              One file, your whole library
            </h2>
          </div>
          <Button className="h-11 rounded-xl" onClick={onImport}>
            <Upload /> {books.length > 0 ? 'Update library' : 'Import library'}
          </Button>
        </div>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Latest import</dt>
            <dd className="mt-1 font-medium">
              {formatDate(snapshot.importedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Source file</dt>
            <dd className="mt-1 truncate font-medium">
              {snapshot.sourceFileName ?? 'No file imported'}
            </dd>
          </div>
        </dl>
        <a
          href="https://www.goodreads.com/review/import"
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Open Goodreads import/export <ExternalLink className="size-3.5" />
        </a>
      </article>

      <article className="mt-4 rounded-[2rem] border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.13em] text-primary uppercase">
              Covers, genres & synopses
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em]">
              Find book details as you need them
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Use the online search beside any book below to look for its cover,
              synopsis, and story details. Your Goodreads books, ratings,
              reviews, shelves, and reading dates stay unchanged.
            </p>
          </div>
          <div>
            <Button
              variant="outline"
              className="h-11 rounded-xl"
              disabled={books.length === 0 || busy !== null}
              onClick={() => metadataRef.current?.click()}
            >
              <Upload />
              {busy === 'metadata-import'
                ? 'Importing…'
                : 'Import a catalog file'}
            </Button>
            <input
              ref={metadataRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => void importMetadata(event.target.files?.[0])}
            />
          </div>
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {matchedMetadata.toLocaleString()} matched ·{' '}
              {completedMetadata.toLocaleString()} checked
              {metadataErrors > 0 &&
                ` · ${metadataErrors.toLocaleString()} to retry`}
            </span>
            <span>{booksWithIsbn.length.toLocaleString()} with ISBN</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{
                width:
                  booksWithIsbn.length === 0
                    ? '0%'
                    : `${Math.round(
                        (Math.min(completedIsbnMetadata, booksWithIsbn.length) /
                          booksWithIsbn.length) *
                          100,
                      )}%`,
              }}
            />
          </div>
        </div>
      </article>

      <article className="mt-4 rounded-[2rem] border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.13em] text-primary uppercase">
              Direct book search
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em]">
              Fix missing book details
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Search your library, then choose Search online to fill missing
              details automatically. You can still review or adjust the result
              with Edit.
            </p>
          </div>
          <span className="rounded-full border border-border bg-background/35 px-3 py-1.5 text-xs text-muted-foreground">
            {incompleteBooks.length.toLocaleString()} need at least one detail
          </span>
        </div>

        <label className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-background/35 px-3">
          <Search className="size-4 text-muted-foreground" />
          <span className="sr-only">Find a book to correct</span>
          <input
            className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            value={correctionQuery}
            onChange={(event) => setCorrectionQuery(event.target.value)}
            placeholder="Search title or author"
          />
        </label>
        {!correctionQuery && (
          <p className="mt-2 text-[0.68rem] text-muted-foreground">
            Showing books with missing information first.
          </p>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {correctionBooks.map((book) => {
            const details = snapshot.bookMetadata[book.id];
            const missing = [
              !details?.coverUrl && 'cover',
              (!details || details.subjects.length === 0) && 'genres',
              !details?.synopsis && 'synopsis',
            ].filter(Boolean);
            return (
              <div
                key={book.id}
                className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-background/28 p-3"
              >
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-semibold">
                    {book.title}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {book.author}
                  </p>
                  <p className="mt-1 text-[0.68rem] text-muted-foreground">
                    {missing.length > 0
                      ? `Missing ${missing.join(', ')}`
                      : 'Catalog details complete'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <Button
                    size="sm"
                    className="rounded-lg"
                    disabled={lookupBookId !== null || busy !== null}
                    onClick={() => void lookupBook(book)}
                  >
                    <Search />
                    {lookupBookId === book.id ? 'Searching…' : 'Search online'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={lookupBookId !== null}
                    onClick={() => setEditingBook(book)}
                  >
                    <Pencil /> Edit
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        {correctionBooks.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            No books match that search.
          </p>
        )}
      </article>

      <article className="mt-4 rounded-[2rem] border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-muted text-primary">
            <LockKeyhole className="size-4" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.025em]">
              Only in this browser
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Your titles, ratings, reviews, shelves, and recommendation profile
              are stored in this browser’s private local database. The app has
              no account, analytics, ads, or server sync.
            </p>
          </div>
        </div>
      </article>

      <article className="mt-4 rounded-[2rem] border border-border bg-card p-6">
        <p className="text-xs font-semibold tracking-[0.13em] text-primary uppercase">
          Backup & restore
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em]">
          Keep a portable copy
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Local browser storage is convenient, but it is not a backup. Download
          a JSON copy before clearing browser data or changing devices.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="h-11 rounded-xl"
            disabled={books.length === 0 || busy !== null}
            onClick={() => void download()}
          >
            <Download /> Download backup
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-xl"
            disabled={busy !== null}
            onClick={() => restoreRef.current?.click()}
          >
            <Upload /> Restore backup
          </Button>
          <input
            ref={restoreRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void restore(event.target.files?.[0])}
          />
        </div>
      </article>

      <article className="mt-4 rounded-[2rem] border border-destructive/25 bg-card p-6">
        <p className="text-xs font-semibold tracking-[0.13em] text-destructive uppercase">
          Local reset
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em]">
          Remove this browser’s copy
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This cannot affect Goodreads. It only removes Next Chapter’s local
          library.
        </p>
        <Button
          variant="destructive"
          className="mt-5 h-11 rounded-xl"
          disabled={books.length === 0 || busy !== null}
          onClick={() => void clear()}
        >
          <Trash2 /> Clear local data
        </Button>
      </article>

      {message && (
        <output className="mt-4 block rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {message}
        </output>
      )}
      {editingBook && (
        <MetadataEditor
          key={editingBook.id}
          book={editingBook}
          metadata={snapshot.bookMetadata}
          onClose={() => setEditingBook(null)}
          onSave={onSaveMetadata}
        />
      )}
    </section>
  );
}
