// Rounds started, finished and abandoned — step I.5.
//
// **What "abandoned" can mean here, and what it cannot.** The track asks for
// *the abandon rate by screen*, and Postgres cannot answer that: the screens
// before a round exists — typing a topic, voting, waiting for generation — leave
// no row, and a room's phase lives in Redis. What *is* recorded is a seat in a
// round and whether it was ever submitted, so the split this section makes is
// **by mode**, where the two abandon for different reasons: alone somebody
// closes a tab, and in a room the round ends without them.
//
// The denominator is the decision. A seat in a round that is **still running**
// has not abandoned anything — it is a game in progress — so it is excluded,
// and counting it would make the rate rise every time somebody presses play.
import { eq, sql } from 'drizzle-orm';

import type { Database } from '../client.js';
import { game, participant } from '../schema/game.js';

type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type Db = Database['db'] | Tx;

/** One mode's rounds. `mode` is `game.mode`: solo or multiplayer. */
export interface RoundCounts {
  readonly mode: string;
  /** Every round in this mode, however it ended. */
  readonly rounds: number;
  /** …that have an `ended_at`. */
  readonly ended: number;
  /** …that have none: still running, or abandoned by everybody at once. */
  readonly open: number;
}

/**
 * Rounds by mode, in one pass.
 *
 * A `group by` over `game`, which is a scan by construction — no index removes
 * the need to look at every row to count them all. That is measured rather
 * than assumed in `admin-games.test.ts`, and at the volume this game will see
 * it is a scan of a table with one row per round played.
 */
export async function countRoundsByMode(db: Db): Promise<readonly RoundCounts[]> {
  return db
    .select({
      mode: game.mode,
      rounds: sql<number>`count(*)::int`,
      ended: sql<number>`count(*) filter (where ${game.endedAt} is not null)::int`,
      open: sql<number>`count(*) filter (where ${game.endedAt} is null)::int`,
    })
    .from(game)
    .groupBy(game.mode)
    .orderBy(game.mode);
}

/** One mode's seats, counted only in rounds that are over. */
export interface SeatCounts {
  readonly mode: string;
  /** Seats in rounds that have ended. The denominator of the abandon rate. */
  readonly seats: number;
  /** …whose player submitted. */
  readonly submitted: number;
}

/**
 * Seats in finished rounds, by mode.
 *
 * **Only rounds that ended**, which is what makes the rate mean *abandoned*
 * rather than *not finished yet*. A seat in a round still running is a game in
 * progress, and counting it would make the abandon rate climb every time
 * somebody presses play and fall again when they submit — a figure that moves
 * for reasons nobody can act on.
 *
 * One row per seat, so a five-player room contributes five: the question is how
 * many *people* left, not how many rooms had somebody leave.
 */
export async function countSeatsByMode(db: Db): Promise<readonly SeatCounts[]> {
  return db
    .select({
      mode: game.mode,
      seats: sql<number>`count(*)::int`,
      submitted: sql<number>`count(*) filter (where ${participant.submittedAt} is not null)::int`,
    })
    .from(participant)
    .innerJoin(game, eq(game.id, participant.gameId))
    .where(sql`${game.endedAt} is not null`)
    .groupBy(game.mode)
    .orderBy(game.mode);
}
