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
import { buttonVariants, Separator } from '@wikifake/ui';
import Link from 'next/link';

import { SITE_DESCRIPTION } from '../src/indexing.js';

/** What a round actually asks of a player, in the order it happens. */
const STEPS: readonly { readonly title: string; readonly detail: string }[] = [
  {
    title: 'Pick a subject',
    detail: 'Any Wikipedia subject. The article is fetched as it stands today.',
  },
  {
    title: 'Read it against a model',
    detail:
      'A model rewrites a few facts. Nothing marks them, and the rest of the article is untouched.',
  },
  {
    title: 'Mark what is wrong',
    detail:
      'Every paragraph you flag is scored: right ones pay, wrong ones cost, and the clock pays too.',
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-12">
      <h1 className="text-center text-4xl font-semibold text-ink">WikiFake</h1>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted">
        {SITE_DESCRIPTION}
      </p>

      <div className="mt-8 flex justify-center">
        {/* A link, styled as the primary button: the front door navigates, and a
            button that navigates is a button a keyboard cannot open in a new
            tab. `solo.tsx` does the same, for the same reason. */}
        <Link href="/play" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
          Play
        </Link>
      </div>

      <Separator className="my-10" />

      <ol className="grid gap-6 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <p className="text-xs font-semibold tracking-wide text-muted">
              {/* Numbered for a reader, not for a screen reader: the list
                  already carries the order. */}
              {String(index + 1).padStart(2, '0')}
            </p>
            <h2 className="mt-1 text-base font-semibold text-ink">{step.title}</h2>
            <p className="mt-1 text-sm text-muted">{step.detail}</p>
          </li>
        ))}
      </ol>

      {/* The falsified text never reaches this page, so this is context rather
          than the attribution C6.1 asks for — that one is rendered beside the
          article itself, during the round and after it. */}
      <p className="mt-10 text-center text-xs text-muted">
        Articles come from Wikipedia and are used under CC BY-SA. In a round they are
        deliberately modified, and are not encyclopaedic content.
      </p>
    </main>
  );
}
