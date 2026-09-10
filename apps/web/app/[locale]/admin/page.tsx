// `/admin` — step I.1.
//
// The shell, and the gate. There is nothing to show yet: I.2 to I.7 add the
// sections, and this step's whole content is *who gets in* — which is worth its
// own step precisely because the sections are worthless if the answer is wrong.
//
// **No redirect anywhere in this file.** Every other gated page in this
// application sends somebody somewhere — `/sign-in`, `/sign-up`,
// `/choose-a-name` — and each of those redirects is an answer: *this page exists
// and you are not allowed on it yet*. Here that answer is the thing being
// withheld, so `requireAdmin` raises a 404 and the page simply never renders.
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { requireAdmin } from '../../../src/admin/gate.js';

/** Not content, and not a page any crawler should hold or index. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Never prerendered: it reads a cookie and answers differently per request. */
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  await requireAdmin();
  const t = await getTranslations('admin');

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-10">
      <h1 className="text-3xl text-ink">{t('title')}</h1>
      <p className="mt-2 max-w-prose text-sm text-muted">{t('lead')}</p>

      {/* The sections arrive in I.2 to I.7. Listed rather than left blank so
          that a first visitor sees what this page is for, and so that the
          order the track chose is visible before it is built. */}
      <ul className="mt-8 space-y-2">
        {(['health', 'players', 'activation', 'games', 'cost', 'content'] as const).map(
          (section) => (
            <li
              key={section}
              className="border-3 border-line-strong bg-surface px-3 py-2 shadow-md"
            >
              <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
                {t(`sections.${section}`)}
              </span>
              <p className="mt-1 text-sm text-ink-2">{t(`answers.${section}`)}</p>
            </li>
          ),
        )}
      </ul>

      <p className="mt-8 text-sm text-muted">{t('readOnly')}</p>
    </main>
  );
}
