'use client';

// Step 11.8 — a render error inside a locale.
//
// A client component, and not by preference: Next's contract for `error.tsx` is
// that it runs in the browser and receives `reset()`. The layout above it is
// still standing when this renders, so the provider is mounted and the copy comes
// from the catalogue like any screen's. When the layout itself is what failed,
// this file is never reached and `app/global-error.tsx` is — which is why that
// one carries its own words.
//
// `digest` is the only part of the error that crosses to the browser: Next
// replaces the message and the stack with a hash in production, deliberately, so
// a thrown string carrying a database URL cannot reach a player. Showing the hash
// is what makes a report actionable — it is the key into the server's logs.
import { buttonVariants, Button } from '@wikifake/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect } from 'react';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // `console.error`, not `src/logger.ts`: that logger is pino reading
    // `process.env`, and importing it here would ship a server logger to every
    // browser. `02-repository-rules.md` allows `console.warn` and
    // `console.error` on the client for exactly this case.
    console.error('render error', { digest: error.digest, message: error.message });
  }, [error]);

  const t = useTranslations('errors.crash');

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-12 text-center">
      <h1 className="text-3xl font-semibold text-ink">{t('title')}</h1>
      <p className="mt-3 text-sm text-muted">{t('description')}</p>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        {/* A button, because this one does not navigate: `reset()` re-renders
            the segment in place, which is the whole point of the boundary. */}
        <Button variant="primary" onClick={reset}>
          {t('retry')}
        </Button>
        <Link href="/" className={buttonVariants({ variant: 'ghost' })}>
          {t('home')}
        </Link>
      </div>

      {error.digest === undefined ? null : (
        <p className="mt-8 text-xs text-muted-2">
          {t('reference', { digest: error.digest })}
        </p>
      )}
    </main>
  );
}
