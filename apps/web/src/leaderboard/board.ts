// What a board screen asks for — step G.5.
//
// The layer that may hold both halves: `@wikifake/db` has the query and
// `@wikifake/domain` has the calendar, and they may not import each other, so
// this is where a period becomes a window.
//
// **Room rounds only.** The track left that open — *"a solo game against a
// self-chosen topic is ranked separately from multiplayer, or not at all"* — and
// the owner chose *not at all*. The reason is the one the track hints at: a solo
// topic is one the player picked, and an easy article gives three falsifications
// found quickly, which is a high score. A room's topic is voted for, so no
// single player chooses it.
//
// That is integrity by construction rather than by surveillance, which is what
// the track asks for at this stage. And it is **reversible without a
// migration**: G.2 writes an entry for every graded round, solo included, so
// turning the solo board on is a parameter rather than a backfill.
import { countBoardPlayers, selectBoard, type BoardRow } from '@wikifake/db';
import { boardWindowOf, type BoardPeriod } from '@wikifake/domain';
import type { Database } from '@wikifake/db';
import type { RegionId } from '@wikifake/protocol';

export interface BoardContext {
  readonly db: Database['db'];
}

/** The mode the boards rank. Named once, so turning solo on is one edit. */
export const RANKED_MODE = 'multiplayer' as const;

/** How many rows a board shows. */
export const BOARD_SIZE = 50;

export interface BoardView {
  readonly period: BoardPeriod;
  /** Null is the world board. */
  readonly region: RegionId | null;
  readonly rows: readonly BoardRow[];
  /** Distinct players in the period — G.6's threshold will read this. */
  readonly players: number;
}

/**
 * One board, ready to render.
 *
 * `atMs` is a parameter like every clock here: the page passes now and a test
 * passes a Thursday. The period decides the window — `null` for all of history,
 * which G.3 chose so that an all-time query carries no clause on `finished_at`.
 *
 * The player count comes back with the rows because G.6 needs it and asking for
 * it separately would be a second round trip for a number the same `where`
 * clause already describes.
 */
export async function readBoard(
  context: BoardContext,
  period: BoardPeriod,
  region: RegionId | null,
  atMs: number,
): Promise<BoardView> {
  const window = boardWindowOf(period, atMs);
  const query = { mode: RANKED_MODE, window, region };

  const [rows, players] = await Promise.all([
    selectBoard(context.db, { ...query, limit: BOARD_SIZE }),
    countBoardPlayers(context.db, query),
  ]);

  return { period, region, rows, players };
}
