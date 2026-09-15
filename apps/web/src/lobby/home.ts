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
import { readBoard } from '../leaderboard/board.js';
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
export async function readHome(
  context: HomeContext,
  viewerId: string | null,
  atMs: number,
): Promise<HomeView> {
  const board = await readBoard(context, 'allTime', null, atMs, viewerId);
  const top = board.rows.slice(0, HOME_BOARD_ROWS).map((row) => ({
    displayName: row.displayName,
    score: row.score,
  }));

  if (viewerId === null) {
    return { ...NOTHING, board: top, today: await readDailyTile(context, null, atMs) };
  }

  const [stats, quests, history, today] = await Promise.all([
    selectPlayerStats(context.db, viewerId),
    readLiveQuests(context, viewerId, atMs),
    selectGameHistory(context.db, viewerId),
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
    board: top,
    today,
    // Finished rounds only, and `endedAt` is what says so: a round somebody
    // walked out of has no score worth listing under "what you played".
    recent: history
      .filter((row): row is typeof row & { endedAt: Date } => row.endedAt !== null)
      .slice(0, RECENT_ROUNDS)
      .map((row) => ({
        gameId: row.gameId,
        topic: row.topic,
        score: row.score,
        endedAt: row.endedAt,
      })),
  };
}
