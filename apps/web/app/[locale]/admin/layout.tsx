// The panel's chassis — step K.1.
//
// The rail, the drawer, the page heading and — since K.2 — the period, around
// whichever section is open. The period is here rather than in a page because
// it belongs to all eight of them: one selector, one address, and every figure
// below it answering for the same window.
//
// **It does not gate**: `requireAdmin` is called by every `page.tsx` and
// `gate.test.ts` holds them to it. A layout that gated as well would mean two
// lookups per load and, worse, a rule with two places to forget it.
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { PageHeading } from '../../../src/admin/page-heading.js';
import { Link } from '../../../src/i18n/navigation.js';
import { PeriodBar } from '../../../src/admin/period-bar.js';
import { Rail, RailDrawer } from '../../../src/admin/rail.js';

/** Never prerendered: every page under it reads a cookie. */
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('home');

  return (
    <div className="flex min-h-dvh bg-bg">
      <Rail />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b-3 border-line-strong bg-surface px-4 py-4 sm:px-6">
          <RailDrawer />
          <PageHeading />
          {/* Step L.5's other half. The site bar above already links home, but
              the panel is the one place somebody arrives at by address and
              leaves by closing the tab — so the way out is named rather than
              inferred from a logo. */}
          <Link href="/" className="ml-auto shrink-0 text-[14px] font-medium text-accent">
            ← {t('nav.backToGame')}
          </Link>
        </header>

        <PeriodBar nowMs={Date.now()} />

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
