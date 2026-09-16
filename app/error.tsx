'use client';

import { useEffect } from 'react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Next Chapter] unhandled error', error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">
          Next Chapter hit an unexpected error
        </h1>
        <p className="text-muted-foreground text-sm leading-6">
          Your imported library is still saved on this device. Nothing was
          deleted.
        </p>
        <p className="text-destructive text-xs leading-5">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="bg-primary text-primary-foreground inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
