// What the dashboard shows — step L.6.
//
// The owner chose a dense home over a hero: the streak, the daily lot, the
// ranking and the last rounds all visible, with *Play* the largest tile among
// them rather than a banner above them. Four figures a returning player would
// otherwise have opened four screens to see.
//
// **Nothing here is a new measurement.** Every field is a row some other screen
// already reads — `selectPlayerStats` for `/profile`, `readLiveQuests` for
// `/quests`, `readBoard` for `/leaderboard`, `selectGameHistory` for the data
// export — and this composes them. A dashboard that computed its own average
// would be a second opinion about a number, which is the failure
// `plans/method/02-repository-rules.md` calls one source of truth.
//
// **A guest gets the null of every field**, not zeroes. A player with no rounds
// has no average, and a dashboard drawing `0%` under *average score* tells them
// they are bad at the game rather than that they have not played it.
import { selectGameHistory, selectPlayerStats, type Database } from '@wikifake/db';

import { readDailyTile, type DailyTile } from '../daily/tile.js';
import { readBoard, type BoardView } from '../leaderboard/board.js';
import { readLiveQuests, type LiveQuest } from '../quests/sets.js';

/** How many finished rounds the home lists. Four: a tile, not a history. */
export const RECENT_ROUNDS = 4;

/** How many board rows it shows. Five: the shape of a top, not of a board. */
export const HOME_BOARD_ROWS = 5;

export interface HomeRound {
  readonly gameId: string;
  readonly topic: string;
  /** Null for a round that ended without this player submitting an answer. */
  readonly score: number | null;
  readonly endedAt: Date;
}

export interface HomeStats {
  readonly gamesFinished: number;
  readonly averageScore: number | null;
  readonly currentStreak: number;
}

export interface HomeView {
  /** Null for a guest, and for an account that has never finished a round. */
  readonly stats: HomeStats | null;
  /** The daily quest still worth doing, or null when there is none to show. */
  readonly daily: LiveQuest | null;
  readonly board: readonly { readonly displayName: string; readonly score: number }[];
  readonly recent: readonly HomeRound[];
  /** N.7 — today's shared article, and where this viewer stands on it. */
  readonly today: DailyTile;
}

export interface HomeContext {
  readonly db: Database['db'];
}

/**
 * Nothing to show, which is what a guest and a first visit both look like.
 *
 * `Omit<…, 'today'>` since N.7: the day's tile is never nothing — a guest sees
 * the article like everybody else, they just take no rank on it — so a constant
 * claiming to be a whole view would be one field that is always overridden.
 */
const NOTHING: Omit<HomeView, 'today'> = {
  stats: null,
  daily: null,
  board: [],
  recent: [],
};

/**
 * The one quest a tile has room for.
 *
 * Unclaimed and incomplete first — that is the one a player can still act on —
 * then complete but unclaimed, which is a reward waiting to be taken. A claimed
 * quest is finished business and is only shown when there is nothing else.
 */
export function dailyWorthShowing(quests: readonly LiveQuest[]): LiveQuest | null {
  const daily = quests.filter((quest) => quest.period === 'daily');
  const rank = (quest: LiveQuest): number =>
    quest.claimedAt !== null ? 2 : quest.complete ? 0 : 1;

  return [...daily].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

/**
 * Everything the home draws, in one pass.
 *
 * The board is read even for a guest, because a board is nobody's in particular
 * and a first visitor seeing real names is the whole argument for showing it —
 * `13-ui-overhaul.md`: *a dashboard that draws zeroes says the game is empty*.
 * Everything else needs an identity and is skipped without one.
 */
/** The head of the board, which is all a tile has room for. */
function topOf(board: BoardView): HomeView['board'] {
  return board.rows.slice(0, HOME_BOARD_ROWS).map((row) => ({
    displayName: row.displayName,
    score: row.score,
  }));
}

export async function readHome(
  context: HomeContext,
  viewerId: string | null,
  atMs: number,
): Promise<HomeView> {
  /*
   * Step R.3 — started before the branch, awaited on both, floating on neither.
   *
   * This was `await readBoard(…)` on its own line. Nothing below feeds the board
   * and the board feeds nothing below — they take the same `viewerId` and the
   * same clock — so every home page load spent one round trip waiting its turn
   * for no reason. Same arithmetic as O.6's, one query further out.
   *
   * A promise created before a branch is the shape track Q spent five steps on,
   * so it is worth saying why this one is held: there is no `await` between here
   * and the `Promise.all` that takes it, on either path, which is what makes a
   * rejection handled rather than an unhandled one.
   */
  const board = readBoard(context, 'allTime', null, atMs, viewerId);

  if (viewerId === null) {
    // The guest path had the same defect and one fewer read: the tile waited on
    // the board too, and needs nothing from it.
    const [rows, today] = await Promise.all([board, readDailyTile(context, null, atMs)]);
    return { ...NOTHING, board: topOf(rows), today };
  }

  const [rows, stats, quests, recent, today] = await Promise.all([
    board,
    selectPlayerStats(context.db, viewerId),
    readLiveQuests(context, viewerId, atMs),
    // Step R.2 — four finished rounds, asked for as four finished rounds. This
    // read every participation the account had ever had and threw all but four
    // away in Node, which cost most for the players who play most.
    selectGameHistory(context.db, viewerId, {
      limit: RECENT_ROUNDS,
      finishedOnly: true,
    }),
    readDailyTile(context, viewerId, atMs),
  ]);

  return {
    stats:
      stats === null
        ? null
        : {
            gamesFinished: stats.gamesFinished,
            averageScore: stats.averageScore,
            currentStreak: stats.currentStreak,
          },
    daily: dailyWorthShowing(quests),
    board: topOf(rows),
    today,
    // Finished rounds only, and `endedAt` is what says so: a round somebody
    // walked out of has no score worth listing under "what you played". The
    // query holds that rule now; the narrowing below is what tells TypeScript.
    recent: recent
      .filter((row): row is typeof row & { endedAt: Date } => row.endedAt !== null)
      .map((row) => ({
        gameId: row.gameId,
        topic: row.topic,
        score: row.score,
        endedAt: row.endedAt,
      })),
  };
}
