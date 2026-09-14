// `/admin` — the way in, and since K.3 the Overview digest.
//
// It kept its address on purpose: anybody with the old one in a bookmark lands
// somewhere that still makes sense. What changed is that it is no longer *the
// panel* — the seven sections have addresses of their own, and this page is the
// summary that decides which of them to open.
//
// **Six readers, run together.** The page's cost is the slowest of them rather
// than the sum, which is the arrangement every section already uses and the
// reason the track's exit gate — under a second on the current volume — is
// still met by the one page that reads everything.
//
// **No redirect anywhere in this file.** Every other gated page in this
// application sends somebody somewhere — `/sign-in`, `/sign-up`,
// `/choose-a-name` — and each of those redirects is an answer: *this page
// exists and you are not allowed on it yet*. Here that answer is the thing
// being withheld, so `requireAdmin` raises a 404 and the page never renders.
import type { Metadata } from 'next';

import { readActivation } from '../../../src/admin/activation.js';
import { rangeAsked, type AskedFor } from '../../../src/admin/asked-range.js';
import { rateFrom, readCost } from '../../../src/admin/cost.js';
import { requireAdmin } from '../../../src/admin/gate.js';
import { readGames } from '../../../src/admin/games.js';
import { readHealth } from '../../../src/admin/health.js';
import { OverviewSection } from '../../../src/admin/overview-screen.js';
import { readPlayers } from '../../../src/admin/players.js';
import { readTraffic } from '../../../src/admin/traffic.js';
import { db } from '../../../src/game/wiring.js';
import { robotsFor } from '../../../src/indexing.js';

export const metadata: Metadata = { robots: robotsFor('/admin') };

/** Never prerendered: it reads a cookie and answers differently per request. */
export const dynamic = 'force-dynamic';

export default async function AdminPage({
  searchParams,
}: {
  readonly searchParams: AskedFor;
}) {
  await requireAdmin();
  const range = await rangeAsked(searchParams);
  // Read here rather than inside: a route is where a real environment and a
  // real clock are allowed to come from.
  const store = db();
  const atMs = Date.now();

  const [players, activation, games, traffic, cost, health] = await Promise.all([
    readPlayers({ db: store }, range, atMs),
    readActivation({ db: store }, range),
    readGames({ db: store }, range),
    readTraffic({ db: store }, range),
    readCost(
      {
        db: store,
        inputCostPerMTok: rateFrom(process.env['MODEL_INPUT_COST_PER_MTOK']),
        outputCostPerMTok: rateFrom(process.env['MODEL_OUTPUT_COST_PER_MTOK']),
      },
      range,
    ),
    readHealth({ db: store, realtimeUrl: process.env['NEXT_PUBLIC_REALTIME_URL'] }),
  ]);

  return (
    <OverviewSection
      players={players}
      activation={activation}
      games={games}
      traffic={traffic}
      cost={cost}
      health={health}
    />
  );
}
