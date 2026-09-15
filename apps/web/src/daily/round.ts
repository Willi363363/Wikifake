// A round on the day's article — step N.5.
//
// **It generates nothing.** `startRound` sources an article for a topic a player
// typed; this one reads the day's, which N.3 already made. So there is no model
// call here and no `recordLlmCalls`: the day was billed once, when it was
// generated, and recording it again against each round would multiply one
// generation by however many people played it.
//
// `fromCache` is `true` for the same reason and it is not a white lie — C4.6
// defines it as *the article was reused rather than generated*, which is exactly
// what happened. A daily round that counted as a generation would make the cost
// per game look higher than it is, every day, once per player.
import {
  createGame,
  hasPlayedDay,
  type Database,
  type NewParticipant,
} from '@wikifake/db';
import { storedPosition } from '@wikifake/article';
import { periodIndexOf } from '@wikifake/domain';
import type { ErrorCode, gameApi } from '@wikifake/protocol';
import { z } from 'zod';

import { ensureDailyArticle, type DailyDependencies } from './article.js';

export interface DailyRoundDependencies extends DailyDependencies {
  readonly db: Database['db'];
}

export interface DailyRoundRequest {
  readonly player: NewParticipant;
  readonly timeLimit: number;
}

export type DailyRoundOutcome =
  | { readonly ok: true; readonly value: gameApi.StartGameResponse }
  | { readonly ok: false; readonly code: ErrorCode; readonly message: string };

/**
 * What the column holds, parsed rather than cast.
 *
 * `paragraphs` and `solution` are `jsonb`, so reading them is parsing them: a
 * row written by a hand edit, or by a version of the generator that has since
 * changed shape, is a row this must refuse rather than hand to `createGame` and
 * discover at the insert.
 */
const storedArticle = z.object({
  paragraphs: z.array(z.string()).min(1),
  solution: z.array(storedPosition).min(1),
});

/**
 * Starts this player's round on the day's article, once.
 *
 * **A second attempt is refused**, and that is what makes the board mean
 * anything: a player free to replay until the score is good is ranked against
 * their own patience rather than against the others.
 *
 * **A guest is not stopped**, because a guest has no identity to stop. Stated
 * rather than hidden: the day's board is `user_id`'s, and anonymous play is
 * outside it in both directions — no attempt used, no rank taken.
 */
export async function startDailyRound(
  dependencies: DailyRoundDependencies,
  request: DailyRoundRequest,
  atMs: number,
): Promise<DailyRoundOutcome> {
  const day = periodIndexOf('daily', atMs);
  const userId = request.player.userId ?? null;

  if (userId !== null && (await hasPlayedDay(dependencies.db, userId, day))) {
    return {
      ok: false,
      code: 'daily_already_played',
      message: 'this account has already played the article of the day',
    };
  }

  const today = await ensureDailyArticle(dependencies, atMs);

  if (today.status !== 'ready') {
    // `generating` and `unavailable` are one answer to a player — come back in a
    // moment — and two to a log. The code carries the first, the status the
    // second, and neither is an exception: a day without an article yet is an
    // ordinary outcome of a game that makes its own content.
    return {
      ok: false,
      code: 'daily_not_ready',
      message: `the article of the day is not ready (${today.status})`,
    };
  }

  const parsed = storedArticle.safeParse({
    paragraphs: today.article.paragraphs,
    solution: today.article.solution,
  });

  if (!parsed.success) {
    return {
      ok: false,
      code: 'daily_not_ready',
      message: 'the article of the day is not in a shape this version can play',
    };
  }

  const started = await createGame(dependencies.db, {
    mode: 'solo',
    topic: today.article.topic,
    sourceUrl: today.article.sourceUrl,
    paragraphs: parsed.data.paragraphs,
    timeLimit: request.timeLimit,
    // C4.6 — reused, not generated. The day paid for itself once.
    fromCache: true,
    solution: parsed.data.solution,
    players: [request.player],
    dailyDay: day,
  });

  return {
    ok: true,
    value: {
      sessionId: started.gameId,
      timeLimit: request.timeLimit,
      topic: today.article.topic,
      paragraphs: parsed.data.paragraphs,
      // Derived from the solution rather than read from the row, for the reason
      // `createGame` derives it: the count is the one thing a player is told
      // about the solution, and two sources for it is one of them being wrong.
      totalFakes: parsed.data.solution.length,
      wikipediaUrl: today.article.sourceUrl,
    },
  };
}
