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
import {
  countBoardPlayers,
  selectBoard,
  selectOwnRank,
  type BoardRow,
  type OwnRank,
} from '@wikifake/db';
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

/**
 * How many distinct players a board needs before it shows anybody — step G.6.
 *
 * The track's rule: *"a leaderboard with four entries makes a game look
 * abandoned… under it, the screen says the ranking opens soon rather than
 * showing three names."* Ten is the number, and what matters more than the
 * number is that it is one number.
 *
 * **Per-period thresholds were considered and refused.** A daily board needs ten
 * players *that day*, which is a much higher bar than ten ever, so the all-time
 * board opens first and the regional dailies open last. That is the right order
 * — the board with the most players in it is the one worth showing — and the
 * alternative is three numbers to tune instead of one.
 *
 * **Distinct players and not entries**, which is why `countBoardPlayers` counts
 * `distinct user_id`: a board that opened at ten *scores* would open when one
 * player had played ten rounds, and that is exactly the abandoned-looking board
 * the rule exists to prevent.
 */
export const BOARD_MIN_PLAYERS = 10;

/** Whether a board has enough players to be shown at all. */
export function isBoardOpen(players: number): boolean {
  return players >= BOARD_MIN_PLAYERS;
}

export interface BoardView {
  readonly period: BoardPeriod;
  /** Null is the world board. */
  readonly region: RegionId | null;
  /**
   * The rows, or **empty when the board is closed**.
   *
   * Withheld here rather than hidden by the screen, and that is the point of
   * doing it in the read path: a screen that decided not to render them is a
   * promise, and a read path that never returns them is a fact. A board below
   * the threshold cannot leak a name through a later refactor of the markup.
   */
  readonly rows: readonly BoardRow[];
  /** Distinct players in the period, whether or not the board is open. */
  readonly players: number;
  /** `players >= BOARD_MIN_PLAYERS`. Decided once, here. */
  readonly open: boolean;
  /**
   * Where the viewer stands — step G.7. Null for four different reasons, and
   * the screen only needs to know that it is null:
   *
   *   - nobody is asking (no session);
   *   - a guest is asking, and a guest has no board identity;
   *   - the player has no qualifying round in this period;
   *   - **the board is closed**, and a rank would leak the ranking the
   *     threshold exists to hide.
   */
  readonly own: OwnRank | null;
  /** The rows either side of the viewer's rank, when they are off the page. */
  readonly around: readonly BoardRow[];
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
/**
 * How many rows to show either side of a player who is off the page.
 *
 * One, so the block is three rows: the neighbour above, the player, and the one
 * below. Enough to see the gap to close, and short enough not to be a second
 * board.
 */
export const AROUND_OWN_RANK = 1;

export async function readBoard(
  context: BoardContext,
  period: BoardPeriod,
  region: RegionId | null,
  atMs: number,
  /** The viewer, when there is one with a board identity. */
  viewerId?: string | null,
): Promise<BoardView> {
  const window = boardWindowOf(period, atMs);
  const query = { mode: RANKED_MODE, window, region };

  const [rows, players] = await Promise.all([
    selectBoard(context.db, { ...query, limit: BOARD_SIZE }),
    countBoardPlayers(context.db, query),
  ]);

  // Both are asked for either way, because the count is what decides and it
  // comes from the same `where` clause. What changes is whether the rows are
  // handed on: below the threshold they are dropped here, so nothing
  // downstream has the option of showing them.
  const open = isBoardOpen(players);
  if (!open) {
    // Nothing about who is on it, including the viewer. A rank on a closed
    // board would leak the ranking the threshold exists to hide — and it would
    // leak it to exactly the player most likely to share it.
    return { period, region, rows: [], players, open, own: null, around: [] };
  }

  const own =
    viewerId === undefined || viewerId === null
      ? null
      : await selectOwnRank(context.db, query, viewerId);

  // Only when they are off the page. A player inside the top fifty is already
  // on it, and a second block repeating their row would be a screen saying the
  // same thing twice.
  const offPage = own !== null && own.rank > rows.length;
  const around = offPage
    ? await selectBoard(context.db, {
        ...query,
        limit: AROUND_OWN_RANK * 2 + 1,
        // `offset` is zero-based, so a rank of R sits at R - 1 and a window of
        // one either side starts at R - 2. It comes back short at the end of
        // the board rather than padded.
        offset: Math.max(0, own.rank - 1 - AROUND_OWN_RANK),
      })
    : [];

  return { period, region, rows, players, open, own, around };
}
