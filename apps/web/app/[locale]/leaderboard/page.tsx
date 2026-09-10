// `/leaderboard` — step G.5.
//
// **No session is required, and that is the decision.** Every other screen this
// effort added is one player's — a profile, their quests — and is `noindex` and
// gated. A board is nobody's: it is the one page a guest can look at and want an
// account because of, so it is readable without one.
//
// The period and the region come from the query string, validated against the
// protocol's closed lists rather than trusted. A value nobody offers falls back
// to the default board rather than refusing the page: a mistyped URL is not
// worth a 400, and there is exactly one sensible answer to give instead.
import type { Metadata } from 'next';

import { boardPeriodId, regionId } from '@wikifake/protocol';
import { decode } from '@wikifake/protocol';
import { BoardScreen } from '../../../src/leaderboard/screen.js';
import { readBoard } from '../../../src/leaderboard/board.js';
import { readViewer } from '../../../src/account/gate.js';
import { db } from '../../../src/game/wiring.js';

/** Whether a board should be indexed is track J's call; nothing here needs it. */
export const metadata: Metadata = { title: 'WikiFake' };

/** Never prerendered: today's board is different tomorrow. */
export const dynamic = 'force-dynamic';

export default async function LeaderboardPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const asked = await searchParams;

  // Daily is the default because it is the board somebody new can still get on.
  const period = decode(boardPeriodId, asked.period);
  const region = decode(regionId, asked.region);

  /*
   * Step G.7 — the viewer, when they are one the board could rank.
   *
   * `readViewer` gives three kinds, and only an **account with a pseudonym** has
   * a rank: a stranger has no identity, and a guest has one the board's own
   * inner join excludes — no `profile` row, so no name to print. Passing a
   * guest's id would ask for a rank that is always null, which works and lies
   * about why.
   *
   * The page is still readable by all three, which is G.5's decision. What
   * changes with a session is only whether the board says where *you* stand.
   */
  const viewer = await readViewer();
  const rankable = viewer.kind === 'account' && viewer.pseudonym !== undefined;

  const board = await readBoard(
    { db: db() },
    period.ok ? period.value : 'daily',
    region.ok ? region.value : null,
    Date.now(),
    rankable ? viewer.userId : null,
  );

  return <BoardScreen board={board} />;
}
