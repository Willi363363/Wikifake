// `/admin` — the way in, and from K.1 the Overview page.
//
// It kept its address on purpose: anybody with the old one in a bookmark lands
// somewhere that still makes sense. What changed is that it is no longer *the
// panel* — the seven sections have addresses of their own now, and this page
// is the summary that decides which of them to open.
//
// K.3 replaces the body below with the digest the owner chose. Until then it
// shows the sections rather than pretending to be one, because a page that
// lies about being finished is worse than a page that says it is not.
//
// **No redirect anywhere in this file.** Every other gated page in this
// application sends somebody somewhere — `/sign-in`, `/sign-up`,
// `/choose-a-name` — and each of those redirects is an answer: *this page
// exists and you are not allowed on it yet*. Here that answer is the thing
// being withheld, so `requireAdmin` raises a 404 and the page never renders.
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { requireAdmin } from '../../../src/admin/gate.js';
import { HealthSection } from '../../../src/admin/health-screen.js';
import { readHealth } from '../../../src/admin/health.js';
import { SectionGlyph } from '../../../src/admin/section-icon.js';
import { GROUPS } from '../../../src/admin/sections.js';
import { db } from '../../../src/game/wiring.js';
import { Link } from '../../../src/i18n/navigation.js';
import { robotsFor } from '../../../src/indexing.js';

export const metadata: Metadata = { robots: robotsFor('/admin') };

/** Never prerendered: it reads a cookie and answers differently per request. */
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  await requireAdmin();
  const t = await getTranslations('admin');
  const health = await readHealth({
    // Read here rather than inside: a route is where a real environment is
    // allowed to come from.
    db: db(),
    realtimeUrl: process.env['NEXT_PUBLIC_REALTIME_URL'],
  });

  return (
    <div className="flex flex-col gap-6">
      <p className="m-0 max-w-prose text-sm text-muted">{t('lead')}</p>

      <HealthSection health={health} />

      <nav
        aria-label={t('nav.label')}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {GROUPS.flatMap((group) => group.sections)
          .filter((section) => section.route !== '/admin')
          .map((section) => (
            <Link
              key={section.route}
              href={section.route}
              className="flex min-h-11 items-center gap-3 border-3 border-line-strong bg-surface px-4 py-4 text-ink shadow-md"
            >
              <SectionGlyph name={section.icon} size={20} />
              <span className="min-w-0 flex-1 truncate text-base font-bold">
                {t(section.key)}
              </span>
            </Link>
          ))}
      </nav>

      <p className="m-0 max-w-prose text-sm text-muted">{t('readOnly')}</p>
    </div>
  );
}
