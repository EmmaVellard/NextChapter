'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { seriesForBook } from '@/lib/series';
import type { BookMetadata, BookMetadataMap, BookRecord } from '@/lib/types';

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-border bg-background/45 px-3 py-2.5 text-sm outline-none focus:border-primary/45 focus:ring-3 focus:ring-ring/30';

function optionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function list(value: string) {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function MetadataEditor({
  book,
  metadata,
  onClose,
  onSave,
}: {
  book: BookRecord;
  metadata: BookMetadataMap;
  onClose: () => void;
  onSave: (entry: BookMetadata) => Promise<void>;
}) {
  const current = metadata[book.id];
  const inferredSeries = seriesForBook(book, metadata);
  const [coverUrl, setCoverUrl] = useState(current?.coverUrl ?? '');
  const [subtitle, setSubtitle] = useState(current?.subtitle ?? '');
  const [synopsis, setSynopsis] = useState(current?.synopsis ?? '');
  const [subjects, setSubjects] = useState(
    (current?.subjects ?? []).join(', '),
  );
  const [publisher, setPublisher] = useState(
    (current?.publishers ?? []).join(', '),
  );
  const [pageCount, setPageCount] = useState(
    current?.pageCount?.toString() ?? '',
  );
  const [publishYear, setPublishYear] = useState(
    current?.firstPublishYear?.toString() ?? '',
  );
  const [seriesName, setSeriesName] = useState(inferredSeries?.name ?? '');
  const [seriesPosition, setSeriesPosition] = useState(
    inferredSeries?.position.toString() ?? '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const normalizedCover = coverUrl.trim();
    if (normalizedCover) {
      try {
        const url = new URL(normalizedCover);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      } catch {
        setError('Use a complete http or https address for the cover.');
        return;
      }
    }
    if (seriesName.trim() && optionalNumber(seriesPosition) === null) {
      setError('Add a valid series position, such as 2 or 0.5.');
      return;
    }

    setBusy(true);
    const now = new Date().toISOString();
    try {
      await onSave({
        bookId: book.id,
        status: 'matched',
        provider: 'manual',
        providerKey: current?.providerKey ?? null,
        sourceUrl: current?.sourceUrl ?? null,
        coverUrl: normalizedCover || null,
        subtitle: subtitle.trim() || null,
        synopsis: synopsis.trim() || null,
        subjects: list(subjects),
        publishers: list(publisher),
        firstPublishYear: optionalNumber(publishYear),
        pageCount: optionalNumber(pageCount),
        fetchedAt: current?.fetchedAt ?? now,
        seriesName: seriesName.trim() || null,
        seriesPosition: seriesName.trim()
          ? optionalNumber(seriesPosition)
          : null,
        manualEditedAt: now,
      });
      onClose();
    } catch {
      setError('Those changes could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border border-border bg-popover p-5 sm:max-w-2xl sm:p-6">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl font-semibold tracking-[-0.03em]">
            Correct book details
          </DialogTitle>
          <DialogDescription className="leading-6">
            Fix missing catalog information for “{book.title}”. The title,
            author, rating, and reading dates continue to come from Goodreads.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit}>
          <div className="grid gap-5 sm:grid-cols-[8rem_1fr]">
            <BookCover
              title={book.title}
              author={book.author}
              coverUrl={coverUrl}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="text-xs font-semibold">Cover image URL</span>
                <input
                  className={fieldClass}
                  value={coverUrl}
                  onChange={(event) => setCoverUrl(event.target.value)}
                  placeholder="https://…"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="text-xs font-semibold">Subtitle</span>
                <input
                  className={fieldClass}
                  value={subtitle}
                  onChange={(event) => setSubtitle(event.target.value)}
                />
              </label>
              <label className="sm:col-span-2">
                <span className="text-xs font-semibold">Short synopsis</span>
                <textarea
                  className={`${fieldClass} min-h-24 resize-y`}
                  value={synopsis}
                  onChange={(event) => setSynopsis(event.target.value)}
                  placeholder="A short, factual description of the story"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="text-xs font-semibold">
                  Genres and story subjects
                </span>
                <input
                  className={fieldClass}
                  value={subjects}
                  onChange={(event) => setSubjects(event.target.value)}
                  placeholder="Fantasy, Epic fiction, Adventure"
                />
                <span className="mt-1 block text-[0.68rem] text-muted-foreground">
                  Separate items with commas. These improve genre filters and
                  your reader profile.
                </span>
              </label>
              <label>
                <span className="text-xs font-semibold">Series name</span>
                <input
                  className={fieldClass}
                  value={seriesName}
                  onChange={(event) => setSeriesName(event.target.value)}
                />
              </label>
              <label>
                <span className="text-xs font-semibold">Volume</span>
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  value={seriesPosition}
                  onChange={(event) => setSeriesPosition(event.target.value)}
                  placeholder="1"
                />
              </label>
              <label>
                <span className="text-xs font-semibold">Publisher</span>
                <input
                  className={fieldClass}
                  value={publisher}
                  onChange={(event) => setPublisher(event.target.value)}
                />
              </label>
              <label>
                <span className="text-xs font-semibold">Pages</span>
                <input
                  className={fieldClass}
                  inputMode="numeric"
                  value={pageCount}
                  onChange={(event) => setPageCount(event.target.value)}
                />
              </label>
              <label>
                <span className="text-xs font-semibold">First published</span>
                <input
                  className={fieldClass}
                  inputMode="numeric"
                  value={publishYear}
                  onChange={(event) => setPublishYear(event.target.value)}
                />
              </label>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-xl border border-destructive/25 bg-destructive/8 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className="mt-5 -mx-5 -mb-5 px-5 sm:-mx-6 sm:-mb-6 sm:px-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              <Save /> {busy ? 'Saving…' : 'Save corrections'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
