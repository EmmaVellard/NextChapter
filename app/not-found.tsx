import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16 text-center">
      <div className="max-w-sm space-y-3">
        <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          Page not found
        </p>
        <h1 className="text-2xl font-semibold">
          That address is not part of Next Chapter
        </h1>
        <p className="text-muted-foreground text-sm">
          Your imported library is still saved on this device.
        </p>
        <Link
          href="/"
          className="bg-primary text-primary-foreground inline-flex min-h-11 items-center rounded-md px-5 text-sm font-medium"
        >
          Open Next Chapter
        </Link>
      </div>
    </main>
  );
}
