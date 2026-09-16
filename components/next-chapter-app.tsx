'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookMarked,
  CheckCircle2,
  Database,
  Feather,
  Sparkles,
} from 'lucide-react';

import { AppMark } from '@/components/app-mark';
import { DataView } from '@/components/data-view';
import { ImportDialog } from '@/components/import-dialog';
import { InsightsView } from '@/components/insights-view';
import { LibraryView } from '@/components/library-view';
import { NextReadView } from '@/components/next-read-view';
import { ViewErrorBoundary } from '@/components/view-error-boundary';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  clearLocalLibrary,
  clearRecommendationFeedback,
  createBackup,
  getLibrarySnapshot,
  importBookMetadataCache,
  describeBackup,
  getSavedBookCount,
  restoreBackup,
  saveBookMetadata,
  saveRecommendationFeedback,
  saveRankingOrder,
} from '@/lib/database';
import { buildTasteProfile } from '@/lib/taste-profile';
import { enrichBookMetadata } from '@/lib/open-library';
import type {
  BookMetadata,
  ImportSummary,
  LibrarySnapshot,
  MetadataProgress,
  RecommendationFeedback,
} from '@/lib/types';

type View = 'next' | 'library' | 'insights' | 'data';

const emptySnapshot: LibrarySnapshot = {
  books: [],
  bookMetadata: {},
  rankingOrder: [],
  recommendationFeedback: [],
  importedAt: null,
  sourceFileName: null,
};
const navigation: Array<{ id: View; label: string; icon: typeof Feather }> = [
  { id: 'next', label: 'Next read', icon: Feather },
  { id: 'library', label: 'To read', icon: BookMarked },
  { id: 'insights', label: 'Insights', icon: Sparkles },
  { id: 'data', label: 'Data', icon: Database },
];

export function NextChapterApp() {
  const [view, setView] = useState<View>('next');
  const [snapshot, setSnapshot] = useState<LibrarySnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<MetadataProgress | null>(
    null,
  );
  const stopEnrichRef = useRef(false);
  const profile = useMemo(
    () => buildTasteProfile(snapshot.books, snapshot.bookMetadata),
    [snapshot.books, snapshot.bookMetadata],
  );

  const refresh = useCallback(async () => {
    setSnapshot(await getLibrarySnapshot());
    setLoading(false);
  }, []);

  // Browser storage can be unavailable entirely (private browsing, evicted
  // data, a blocked upgrade). Without this the loading flag was never cleared
  // and every view showed its skeleton forever.
  const reportLoadFailure = useCallback((error: unknown) => {
    console.error('[Next Chapter] could not open the local library', error);
    setLoadError(
      error instanceof Error
        ? error.message
        : 'Next Chapter could not open its local storage in this browser.',
    );
    setLoading(false);
  }, []);

  function retryLoad() {
    setLoadError(null);
    setLoading(true);
    void refresh().catch(reportLoadFailure);
  }

  useEffect(() => {
    let cancelled = false;
    void getLibrarySnapshot()
      .then((next) => {
        if (cancelled) return;
        setSnapshot(next);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        reportLoadFailure(error);
      });
    return () => {
      cancelled = true;
    };
  }, [reportLoadFailure]);

  function changeView(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleImported(summary: ImportSummary) {
    await refresh();
    setAnnouncement(
      `${summary.importedBooks.toLocaleString()} books imported and saved on this device.`,
    );
  }

  async function downloadBackup() {
    const backup = await createBackup();
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `next-chapter-backup-${backup.createdAt.slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handleRestore(file: File) {
    if (file.size > 50 * 1024 * 1024)
      throw new Error('This backup is too large to restore safely.');
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      throw new Error('This file is not valid JSON.');
    }
    // Validate and count before asking, so the confirmation can state exactly
    // what is being replaced and an unusable file fails before the prompt.
    const incoming = describeBackup(parsed);
    const savedCount = await getSavedBookCount();
    const replacing =
      savedCount === 0
        ? 'Your library is currently empty.'
        : `This replaces the ${savedCount.toLocaleString()} books saved on this device.`;
    if (
      !window.confirm(
        `Restore ${incoming.books.toLocaleString()} books from this backup? ${replacing} This cannot be undone.`,
      )
    ) {
      throw new Error(
        'Restore cancelled. Your current library was not changed.',
      );
    }
    await restoreBackup(parsed);
    await refresh();
    setAnnouncement('Next Chapter backup restored.');
  }

  async function handleMetadataImport(file: File) {
    if (file.size > 25 * 1024 * 1024) {
      throw new Error('This catalog file is too large to import safely.');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      throw new Error('This catalog file is not valid JSON.');
    }
    const result = await importBookMetadataCache(parsed);
    await refresh();
    setAnnouncement(
      `${result.imported.toLocaleString()} catalog records added without changing your library.`,
    );
    return result;
  }

  async function clearData() {
    if (
      !window.confirm(
        'Remove all Next Chapter data from this browser? Your Goodreads account will not be changed.',
      )
    )
      return;
    await clearLocalLibrary();
    await refresh();
    setView('next');
    setAnnouncement('Local Next Chapter data removed.');
  }

  // Open Library allows browser requests and the helper batches eight ISBNs per
  // call with a pause between calls, so the whole library can be filled in from
  // the app instead of from a terminal. Saved entries persist as they arrive,
  // so stopping keeps what is done and a later run resumes from there.
  async function enrichMetadata() {
    if (enriching) return;
    stopEnrichRef.current = false;
    setEnriching(true);
    setEnrichProgress(null);
    try {
      const finalProgress = await enrichBookMetadata({
        books: snapshot.books,
        existing: snapshot.bookMetadata,
        includeTitleFallback: true,
        save: saveBookMetadata,
        onProgress: setEnrichProgress,
        shouldStop: () => stopEnrichRef.current,
      });
      await refresh();
      setAnnouncement(
        stopEnrichRef.current
          ? `Stopped. ${finalProgress.matched.toLocaleString()} of ${finalProgress.total.toLocaleString()} books have details so far.`
          : `${finalProgress.matched.toLocaleString()} of ${finalProgress.total.toLocaleString()} books now have catalog details.`,
      );
    } catch (error) {
      console.error('[Next Chapter] catalog lookup failed', error);
      setAnnouncement(
        'The catalog lookup could not finish. Anything already found was saved.',
      );
      await refresh().catch(() => {});
    } finally {
      setEnriching(false);
      setEnrichProgress(null);
    }
  }

  function stopEnrichMetadata() {
    stopEnrichRef.current = true;
  }

  async function handleMetadataSave(entry: BookMetadata) {
    await saveBookMetadata(entry);
    await refresh();
    setAnnouncement('Book details saved on this device.');
  }

  async function handleRankingOrderChange(ids: string[]) {
    await saveRankingOrder(ids);
    await refresh();
    setAnnouncement(
      ids.length
        ? 'Personal ranking order saved.'
        : 'Ranking reset to your Goodreads ratings.',
    );
  }

  async function handleRecommendationFeedback(entry: RecommendationFeedback) {
    const next = await saveRecommendationFeedback(entry);
    await refresh();
    return next;
  }

  async function handleRecommendationFeedbackReset() {
    await clearRecommendationFeedback();
    await refresh();
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <button
            type="button"
            className="flex min-h-11 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/55"
            onClick={() => changeView('next')}
          >
            <AppMark className="size-7 text-primary" />
            <span className="whitespace-nowrap font-serif text-lg tracking-[-0.025em]">
              Next Chapter
            </span>
          </button>

          {/* Text with a quiet underline rather than a row of pills: the boxes
              competed with the content for attention. */}
          <nav
            className="hidden items-center gap-6 md:flex"
            aria-label="Primary navigation"
          >
            {navigation.map((item) => {
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => changeView(item.id)}
                  className={`relative flex min-h-11 items-center text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/55 focus-visible:outline-none ${
                    active
                      ? 'text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="bg-primary absolute inset-x-0 -bottom-0.5 h-px rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pt-8 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] sm:px-8 sm:pt-12 sm:pb-16 lg:px-10">
        {loadError && (
          <div
            role="alert"
            className="border-destructive/35 bg-destructive/10 rounded-xl border p-5 sm:p-6"
          >
            <h2 className="text-xl font-semibold">
              Next Chapter could not open your local library
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-6">
              This browser blocked or could not read the storage Next Chapter
              uses. Private browsing windows and cleared site data are the usual
              causes. Your Goodreads account is unaffected.
            </p>
            <p className="text-destructive mt-3 text-xs leading-5">
              {loadError}
            </p>
            <button
              type="button"
              onClick={retryLoad}
              className="bg-primary text-primary-foreground mt-4 inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold"
            >
              Try again
            </button>
          </div>
        )}
        {!loadError && view === 'next' && (
          <ViewErrorBoundary name="Next read">
            <NextReadView
              books={snapshot.books}
              metadata={snapshot.bookMetadata}
              profile={profile}
              feedback={snapshot.recommendationFeedback}
              loading={loading}
              onImport={() => setImportOpen(true)}
              onFeedback={handleRecommendationFeedback}
              onResetFeedback={handleRecommendationFeedbackReset}
            />
          </ViewErrorBoundary>
        )}
        {!loadError && view === 'library' && (
          <ViewErrorBoundary name="Library">
            <LibraryView
              books={snapshot.books}
              metadata={snapshot.bookMetadata}
              loading={loading}
              onImport={() => setImportOpen(true)}
            />
          </ViewErrorBoundary>
        )}
        {!loadError && view === 'insights' && (
          <ViewErrorBoundary name="Insights">
            <InsightsView
              books={snapshot.books}
              metadata={snapshot.bookMetadata}
              profile={profile}
              rankingOrder={snapshot.rankingOrder}
              loading={loading}
              onImport={() => setImportOpen(true)}
              onRankingOrderChange={handleRankingOrderChange}
            />
          </ViewErrorBoundary>
        )}
        {!loadError && view === 'data' && (
          <ViewErrorBoundary name="Settings & data">
            <DataView
              snapshot={snapshot}
              loading={loading}
              onImport={() => setImportOpen(true)}
              onDownloadBackup={downloadBackup}
              onRestoreBackup={handleRestore}
              onImportMetadata={handleMetadataImport}
              onSaveMetadata={handleMetadataSave}
              onEnrich={enrichMetadata}
              onStopEnrich={stopEnrichMetadata}
              enriching={enriching}
              enrichProgress={enrichProgress}
              onClear={clearData}
            />
          </ViewErrorBoundary>
        )}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/94 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        aria-label="Primary navigation"
      >
        <div className="mx-auto grid max-w-md grid-cols-4 px-2 py-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => changeView(item.id)}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 text-[11px] transition-colors focus-visible:ring-3 focus-visible:ring-ring/55 focus-visible:outline-none ${
                  active
                    ? 'text-primary font-semibold'
                    : 'text-muted-foreground'
                }`}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
                {/* A small dot instead of a filled tile behind the whole item. */}
                <span
                  aria-hidden="true"
                  className={`size-1 rounded-full transition-colors ${
                    active ? 'bg-primary' : 'bg-transparent'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </nav>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleImported}
      />
      {announcement && (
        <button
          type="button"
          aria-live="polite"
          onClick={() => setAnnouncement(null)}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] left-1/2 z-50 flex w-[min(420px,calc(100%-2rem))] -translate-x-1/2 items-center gap-2 rounded-xl border border-primary/25 bg-popover px-4 py-3 text-left text-sm shadow-2xl sm:bottom-6"
        >
          <CheckCircle2 className="size-4 shrink-0 text-primary" />
          {announcement}
        </button>
      )}
    </div>
  );
}
