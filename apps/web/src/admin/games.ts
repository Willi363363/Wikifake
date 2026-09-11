// Rounds, and where they are lost — step I.5.
//
// Two queries become one table with a row per mode and a total. The arithmetic
// is `shareOf`, which is I.4's single division: the exit gate's *no in-memory
// maths a second implementation could disagree with* is satisfied by there
// being one implementation, not by there being none.
import { countRoundsByMode, countSeatsByMode, type Database } from '@wikifake/db';

import { shareOf } from './activation.js';
import { windowOf, type Range } from './range.js';

export interface GamesContext {
  readonly db: Database['db'];
}

/** The two modes, named so a mode with no rounds still gets a row. */
export const MODES = ['solo', 'multiplayer'] as const;
export type Mode = (typeof MODES)[number] | 'all';

export interface ModeRow {
  readonly mode: Mode;
  readonly rounds: number;
  readonly ended: number;
  readonly open: number;
  /** Seats in ended rounds — the denominator below. */
  readonly seats: number;
  readonly submitted: number;
  readonly abandoned: number;
  /**
   * Abandoned over seats in **ended** rounds, or null when there are none.
   *
   * Null and not zero, for `shareOf`'s reason: no rounds have ended is not
   * *nobody abandoned one*.
   */
  readonly abandonRate: number | null;
}

export interface GamesView {
  readonly rows: readonly ModeRow[];
  /** The `all` row, lifted out because it is the figure worth reading first. */
  readonly total: ModeRow;
}

function rowFor(
  mode: Mode,
  rounds: { rounds: number; ended: number; open: number },
  seats: { seats: number; submitted: number },
): ModeRow {
  const abandoned = seats.seats - seats.submitted;
  return {
    mode,
    ...rounds,
    ...seats,
    abandoned,
    abandonRate: shareOf(abandoned, seats.seats),
  };
}

/**
 * The games section, ready to render.
 *
 * **A row per mode even when a mode has none**, because an absent row and a
 * zero say different things to somebody reading a dashboard: the first looks
 * like a bug in the panel and the second is a fact about the game.
 *
 * The total is summed here rather than asked for separately, and that is
 * deliberate: a third query with its own `where` clause is a third chance to
 * disagree with the two above it. Summing the rows cannot.
 */
export async function readGames(context: GamesContext, range: Range): Promise<GamesView> {
  const window = windowOf(range);
  const [rounds, seats] = await Promise.all([
    countRoundsByMode(context.db, window),
    countSeatsByMode(context.db, window),
  ]);

  const roundsFor = (mode: string) =>
    rounds.find((row) => row.mode === mode) ?? { rounds: 0, ended: 0, open: 0 };
  const seatsFor = (mode: string) =>
    seats.find((row) => row.mode === mode) ?? { seats: 0, submitted: 0 };

  const rows = MODES.map((mode) => rowFor(mode, roundsFor(mode), seatsFor(mode)));

  const sum = (pick: (row: ModeRow) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);

  const total = rowFor(
    'all',
    {
      rounds: sum((row) => row.rounds),
      ended: sum((row) => row.ended),
      open: sum((row) => row.open),
    },
    { seats: sum((row) => row.seats), submitted: sum((row) => row.submitted) },
  );

  return { rows, total };
}
