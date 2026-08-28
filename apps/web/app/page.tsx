// C7.3 — the front door, which has to be a page.
//
// It was a redirect to `/play` until step 10.0, and that is a contract
// violation rather than a style choice: C7.3 says `GET /` answers HTML 200 with
// a non-empty `<title>`, and a redirect answers 307 with no document at all. The
// probe and the crawler both read the literal response, and the sitemap declares
// this URL — a declared URL that redirects is a declared URL a crawler drops.
//
// Not a copy of the entry screen, which is the reason the redirect existed. The
// entry lives inside the `(game)` group because the socket provider has to be
// mounted before a room is opened, and duplicating it here would be a second
// place to keep in step. This is the one thing that group cannot hold: a static,
// server-rendered, indexable page. It says what the game is and points at it.
//
// Since step 11.1 the copy lives in `messages/<locale>/home.json` and is read
// through `next-intl` — this page is the proof screen: the first one rendered
// through the catalogue in both locales (`page.locale.test.tsx`). The metadata
// in `layout.tsx` still reads `src/indexing.ts` until step 11.5 makes it
// per-locale; `page.locale.test.tsx` pins the two English copies together so
// they cannot drift apart in the meantime.
import { buttonVariants, Separator } from '@wikifake/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

/**
 * What a round actually asks of a player, in the order it happens.
 *
 * Keys into the `home.steps` namespace rather than the sentences themselves:
 * the copy is the catalogue's, the order is this page's.
 */
const STEPS = ['pick', 'read', 'mark'] as const;

export default function HomePage() {
  // Works in a server component: `next-intl` resolves it against
  // `src/i18n/request.ts` here, and against the provider when client-rendered.
  const t = useTranslations('home');

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-12">
      <h1 className="text-center text-4xl font-semibold text-ink">{t('title')}</h1>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted">
        {t('description')}
      </p>

      <div className="mt-8 flex justify-center">
        {/* A link, styled as the primary button: the front door navigates, and a
            button that navigates is a button a keyboard cannot open in a new
            tab. `solo.tsx` does the same, for the same reason. */}
        <Link href="/play" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
          {t('play')}
        </Link>
      </div>

      <Separator className="my-10" />

      <ol className="grid gap-6 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step}>
            <p className="text-xs font-semibold tracking-wide text-muted">
              {/* Numbered for a reader, not for a screen reader: the list
                  already carries the order. */}
              {String(index + 1).padStart(2, '0')}
            </p>
            <h2 className="mt-1 text-base font-semibold text-ink">
              {t(`steps.${step}.title`)}
            </h2>
            <p className="mt-1 text-sm text-muted">{t(`steps.${step}.detail`)}</p>
          </li>
        ))}
      </ol>

      {/* The falsified text never reaches this page, so this is context rather
          than the attribution C6.1 asks for — that one is rendered beside the
          article itself, during the round and after it. */}
      <p className="mt-10 text-center text-xs text-muted">{t('licence')}</p>
    </main>
  );
}
