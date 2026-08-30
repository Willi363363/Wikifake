// Step 11.8 — a 404 inside a locale.
//
// Until this step there was no `not-found.tsx` anywhere, so an unknown URL got
// Next's built-in page: English words no catalogue reaches, unstyled, under a
// French interface. Step 11.2 moved the strings that existed; this page had none
// because it did not exist, which is why it is its own step.
//
// It sits under `[locale]`, so the layout has already run: `lang` is set, the
// provider is mounted, and the copy is read like any other screen's. The 404 for
// a URL whose first segment is not a locale is a different page — `app/not-found.tsx`
// — because such a URL never reaches this segment at all.
import { buttonVariants } from '@wikifake/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function LocaleNotFound() {
  const t = useTranslations('errors.notFound');

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-12 text-center">
      <h1 className="text-3xl font-semibold text-ink">{t('title')}</h1>
      <p className="mt-3 text-sm text-muted">{t('description')}</p>

      {/* Links rather than buttons: both of these navigate, and a button that
          navigates is one a keyboard cannot open in a new tab. `page.tsx` makes
          the same choice for the same reason. */}
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link href="/" className={buttonVariants({ variant: 'primary' })}>
          {t('home')}
        </Link>
        <Link href="/play" className={buttonVariants({ variant: 'ghost' })}>
          {t('play')}
        </Link>
      </div>
    </main>
  );
}
