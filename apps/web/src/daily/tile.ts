// What the home tile knows about today — step N.7.
//
// **It reads and never generates**, which is the decision this file exists to
// make. `ensureDailyArticle` claims the day and calls a model when nobody has;
// putting that behind a dashboard render would mean the home page of a quiet
// morning buys an article, and a crawler or a preflight request buys one too.
//
// So this asks `selectDay`, which answers null for a day nobody has made yet,
// and the tile says *being prepared*. The generation happens where somebody
// actually asked for a round — N.5 — or ahead of time in the cron.
//
// The consequence, stated rather than discovered: on a day whose cron did not
// run, the first player sees "being prepared" and gets the article by pressing
// Play. That is the read path doing its job, one screen further out.
import {
  countDailyPlayers,
  hasPlayedDay,
  selectDay,
  selectOwnDailyRank,
  type Database,
} from '@wikifake/db';
import { periodIndexOf } from '@wikifake/domain';

export interface DailyTile {
  /** The day index, so a screen can key on it without recomputing the calendar. */
  readonly day: number;
  /** The article's title, or null while there is no article for today yet. */
  readonly topic: string | null;
  /** Whether this viewer has spent their one attempt. False for a guest. */
  readonly played: boolean;
  /** Where they stand, or null when they have not finished it. Null is not last. */
  readonly rank: number | null;
  readonly score: number | null;
  /** How many players have finished the day. Zero is a fact, not a gap. */
  readonly players: number;
}

/**
 * Today, as a tile sees it.
 *
 * **A guest gets the article and nothing else**, which is N.5's hole read from
 * the other side: anonymous play spends no attempt and takes no rank, so there
 * is nothing to ask about them and asking would be three queries for four nulls.
 */
export async function readDailyTile(
  context: { readonly db: Database['db'] },
  viewerId: string | null,
  atMs: number,
): Promise<DailyTile> {
  const day = periodIndexOf('daily', atMs);

  const [article, players] = await Promise.all([
    selectDay(context.db, day),
    countDailyPlayers(context.db, day),
  ]);

  if (viewerId === null) {
    return {
      day,
      topic: article?.topic ?? null,
      played: false,
      rank: null,
      score: null,
      players,
    };
  }

  const [played, standing] = await Promise.all([
    hasPlayedDay(context.db, viewerId, day),
    selectOwnDailyRank(context.db, day, viewerId),
  ]);

  return {
    day,
    topic: article?.topic ?? null,
    // `played` and `standing` answer different questions: a round started and
    // abandoned spends the attempt and earns no rank, so a player can be
    // `played: true` with `rank: null` and the tile must not read that as "not
    // played yet" and invite them to start another.
    played,
    rank: standing?.rank ?? null,
    score: standing?.score ?? null,
    players,
  };
}
