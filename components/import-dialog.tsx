'use client';

import { useRef, useState } from 'react';
import {
  CheckCircle2,
  FileSpreadsheet,
  LoaderCircle,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { importGoodreadsFile } from '@/lib/database';
import type { ImportSummary } from '@/lib/types';

export function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (summary: ImportSummary) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const nextSummary = await importGoodreadsFile(file);
      await onImported(nextSummary);
      setSummary(nextSummary);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'The import did not finish.',
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function close() {
    if (busy) return;
    setError(null);
    setSummary(null);
    setDragActive(false);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border border-border bg-popover p-5 sm:max-w-xl sm:p-6">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl font-semibold tracking-[-0.03em]">
            Import your Goodreads library
          </DialogTitle>
          <DialogDescription className="leading-6">
            Choose the CSV from Goodreads → My Books → Import and export. It
            stays in this browser.
          </DialogDescription>
        </DialogHeader>

        {busy ? (
          <div className="rounded-2xl border border-primary/25 bg-primary/8 p-6 text-center">
            <LoaderCircle
              className="mx-auto size-7 animate-spin text-primary"
              aria-hidden="true"
            />
            <p className="mt-3 font-medium">Opening your library…</p>
          </div>
        ) : summary ? (
          <div className="rounded-2xl border border-primary/25 bg-primary/8 p-5">
            <CheckCircle2 className="size-7 text-primary" aria-hidden="true" />
            <h3 className="mt-4 text-lg font-semibold">Library ready</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Imported {summary.importedBooks.toLocaleString()} books from{' '}
              {summary.fileName}.
            </p>
            {summary.skippedRows > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Skipped {summary.skippedRows} rows without a title or author.
              </p>
            )}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/8 p-5">
            <XCircle className="size-6 text-destructive" aria-hidden="true" />
            <p className="mt-3 font-medium">That file could not be imported</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {error}
            </p>
            <Button
              variant="outline"
              className="mt-4 h-10 rounded-xl"
              onClick={() => inputRef.current?.click()}
            >
              Choose another file
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className={`w-full rounded-[1.5rem] border border-dashed p-8 text-center transition-colors ${dragActive ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/45 hover:bg-primary/5'}`}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              void handleFile(event.dataTransfer.files[0]);
            }}
          >
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary-muted text-primary">
              <FileSpreadsheet className="size-5" aria-hidden="true" />
            </span>
            <p className="mt-4 font-semibold">Drop your Goodreads CSV here</p>
            <p className="mt-1 text-sm text-muted-foreground">
              or tap to browse files
            </p>
          </button>
        )}

        <input
          ref={inputRef}
          className="block w-full cursor-pointer rounded-xl border border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary-muted file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />

        <div className="rounded-xl border border-border bg-card/60 px-4 py-3 text-xs leading-5 text-muted-foreground">
          Next Chapter reads your shelves, ratings, dates, page counts, authors,
          and Goodreads average ratings. It never changes your Goodreads
          account.
        </div>

        <DialogFooter className="-mx-5 -mb-5 px-5 sm:-mx-6 sm:-mb-6 sm:px-6">
          {summary ? (
            <Button className="h-10 rounded-xl px-5" onClick={close}>
              Start choosing
            </Button>
          ) : (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={close}
            >
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
