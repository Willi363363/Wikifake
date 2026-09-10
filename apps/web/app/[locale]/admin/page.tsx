// `/admin` — step I.1.
//
// The shell, the gate, and — since I.2 — the health section. I.3 to I.7 add the
// rest, and each arrives as one more call between the gate and the list of what
// is still to come.
//
// **No redirect anywhere in this file.** Every other gated page in this
// application sends somebody somewhere — `/sign-in`, `/sign-up`,
// `/choose-a-name` — and each of those redirects is an answer: *this page exists
// and you are not allowed on it yet*. Here that answer is the thing being
// withheld, so `requireAdmin` raises a 404 and the page simply never renders.
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { HealthSection } from '../../../src/admin/health-screen.js';
import { readHealth } from '../../../src/admin/health.js';
import { ActivationSection } from '../../../src/admin/activation-screen.js';
import { readActivation } from '../../../src/admin/activation.js';
import { CostSection } from '../../../src/admin/cost-screen.js';
import { rateFrom, readCost } from '../../../src/admin/cost.js';
import { GamesSection } from '../../../src/admin/games-screen.js';
import { readGames } from '../../../src/admin/games.js';
import { PlayersSection } from '../../../src/admin/players-screen.js';
import { readPlayers } from '../../../src/admin/players.js';
import { requireAdmin } from '../../../src/admin/gate.js';
import { db } from '../../../src/game/wiring.js';

/** Not content, and not a page any crawler should hold or index. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Never prerendered: it reads a cookie and answers differently per request. */
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  await requireAdmin();
  const t = await getTranslations('admin');
  // `Date.now()` here rather than inside the read path: a route is where a real
  // clock is allowed to come from, which is the split every feature in this
  // repository makes.
  const players = await readPlayers({ db: db() }, Date.now());
  const activation = await readActivation({ db: db() });
  const games = await readGames({ db: db() });
  const cost = await readCost(
    {
      db: db(),
      // Read here rather than inside: a route is where a real environment is
      // allowed to come from.
      inputCostPerMTok: rateFrom(process.env['MODEL_INPUT_COST_PER_MTOK']),
      outputCostPerMTok: rateFrom(process.env['MODEL_OUTPUT_COST_PER_MTOK']),
    },
    Date.now(),
  );
  const health = await readHealth({
    db: db(),
    // Read here rather than inside: a route is where a real environment is
    // allowed to come from, which is the same split `Date.now()` gets
    // everywhere else in this repository.
    realtimeUrl: process.env['NEXT_PUBLIC_REALTIME_URL'],
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-10">
      <h1 className="text-3xl text-ink">{t('title')}</h1>
      <p className="mt-2 max-w-prose text-sm text-muted">{t('lead')}</p>

      <HealthSection health={health} />
      <PlayersSection players={players} />
      <ActivationSection activation={activation} />
      <GamesSection games={games} />
      <CostSection cost={cost} />

      {/* The sections still to come, listed rather than left blank so that the
          order the track chose is visible before it is built. */}
      <ul className="mt-8 space-y-2">
        {(['content'] as const).map((section) => (
          <li
            key={section}
            className="border-3 border-line-strong bg-surface px-3 py-2 shadow-md"
          >
            <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
              {t(`sections.${section}`)}
            </span>
            <p className="mt-1 text-sm text-ink-2">{t(`answers.${section}`)}</p>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm text-muted">{t('readOnly')}</p>
    </main>
  );
}
