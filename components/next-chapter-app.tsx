'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookMarked,
  BookOpen,
  CheckCircle2,
  Database,
  Feather,
  Sparkles,
} from 'lucide-react';

import { DataView } from '@/components/data-view';
import { ImportDialog } from '@/components/import-dialog';
import { InsightsView } from '@/components/insights-view';
import { LibraryView } from '@/components/library-view';
import { NextReadView } from '@/components/next-read-view';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  clearLocalLibrary,
  clearRecommendationFeedback,
  createBackup,
  getLibrarySnapshot,
  importBookMetadataCache,
  restoreBackup,
  saveBookMetadata,
  saveRecommendationFeedback,
  saveRankingOrder,
} from '@/lib/database';
import { buildTasteProfile } from '@/lib/taste-profile';
import type {
  BookMetadata,
  ImportSummary,
  LibrarySnapshot,
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
  const profile = useMemo(
    () => buildTasteProfile(snapshot.books, snapshot.bookMetadata),
    [snapshot.books, snapshot.bookMetadata],
  );

  const refresh = useCallback(async () => {
    setSnapshot(await getLibrarySnapshot());
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getLibrarySnapshot().then((next) => {
      if (cancelled) return;
      setSnapshot(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (
      !window.confirm(
        'Restore this backup? It will replace the current local Next Chapter library.',
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
            <span className="grid size-9 place-items-center rounded-xl bg-[linear-gradient(145deg,#73d8c1,#4a83c4)] text-[#071f22] shadow-[0_8px_28px_rgba(70,199,174,0.22)]">
              <BookOpen className="size-4" />
            </span>
            <span className="whitespace-nowrap font-serif text-lg font-semibold tracking-[-0.025em]">
              Next Chapter
            </span>
          </button>

          <nav
            className="hidden items-center rounded-xl border border-border bg-card/75 p-1 md:flex"
            aria-label="Primary navigation"
          >
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => changeView(item.id)}
                  className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/55 ${active ? 'bg-primary-muted text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pt-8 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] sm:px-8 sm:pt-12 sm:pb-16 lg:px-10">
        {view === 'next' && (
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
        )}
        {view === 'library' && (
          <LibraryView
            books={snapshot.books}
            metadata={snapshot.bookMetadata}
            loading={loading}
            onImport={() => setImportOpen(true)}
          />
        )}
        {view === 'insights' && (
          <InsightsView
            books={snapshot.books}
            metadata={snapshot.bookMetadata}
            profile={profile}
            rankingOrder={snapshot.rankingOrder}
            loading={loading}
            onImport={() => setImportOpen(true)}
            onRankingOrderChange={handleRankingOrderChange}
          />
        )}
        {view === 'data' && (
          <DataView
            snapshot={snapshot}
            loading={loading}
            onImport={() => setImportOpen(true)}
            onDownloadBackup={downloadBackup}
            onRestoreBackup={handleRestore}
            onImportMetadata={handleMetadataImport}
            onSaveMetadata={handleMetadataSave}
            onClear={clearData}
          />
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
                className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors ${active ? 'bg-primary-muted text-primary' : 'text-muted-foreground'}`}
              >
                <Icon className="size-4" />
                {item.label}
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
