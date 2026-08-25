// Starting a solo round: cache, Wikipedia, model, database.
//
// The chain that produces the article is `sourceArticle`, in `@wikifake/article`
// — multiplayer needs exactly the same one (step 5.8), and two copies of "how a
// round gets its article" would be two answers to C3.7 and C4.5 with nothing
// making them agree. What is left here is what is solo's: a game row, the
// participant, and the response a player may see.
//
// Everything takes its collaborators as parameters. Not for elegance: it is what
// lets the leak assertion of C1.1 run against the real assembly with a mocked
// model and a frozen page, rather than against a hand-built payload that proves
// the test author knows the contract.
//
// The one rule that is not negotiable in this file: **the solution is never put
// into the response object at all**. `startGameResponse` would strip it, and that
// encoder is the guarantee — but a payload that never held it cannot be leaked
// by a future schema change either.
import {
  sourceArticle,
  type SourceDependencies,
  type SourceFailure,
} from '@wikifake/article';
import {
  createGame,
  recordLlmCalls,
  type Database,
  type NewParticipant,
} from '@wikifake/db';
import type { ErrorCode, gameApi } from '@wikifake/protocol';

type Db = Database['db'];

export interface RoundDependencies extends SourceDependencies {
  readonly db: Db;
}

/** What a failure is called to a player. The chain itself names no code. */
const REFUSAL: Readonly<Record<SourceFailure, { code: ErrorCode; message: string }>> = {
  topic_not_found: {
    code: 'topic_not_found',
    message: 'No Wikipedia article matches that topic.',
  },
  wikipedia_unreachable: {
    code: 'generation_failed',
    message: 'Wikipedia could not be read right now.',
  },
  falsification_failed: {
    code: 'generation_failed',
    message: 'That article could not be falsified.',
  },
};

export interface RoundRequest {
  /** What the player typed. Also the cache category. */
  readonly topic: string;
  readonly timeLimit: number;
  readonly player: NewParticipant;
}

/**
 * A round, or a reason there is none.
 *
 * A failure is a value rather than an exception: a topic with no article is an
 * ordinary outcome of letting players type whatever they like, and the current
 * code wraps three nested `try` blocks around that fact.
 */
export type RoundOutcome =
  | { readonly ok: true; readonly value: gameApi.StartGameResponse }
  | { readonly ok: false; readonly code: ErrorCode; readonly message: string };

/**
 * Starts a solo round and returns what the player may see.
 *
 * The session handle is the game's own identifier. It is not a bearer token and
 * is not treated as a secret: the routes that follow authorise on the session
 * cookie — is this caller a participant of that game — which is what the Python's
 * `secrets.token_urlsafe(12)` was standing in for, badly, from an in-memory
 * registry that a restart emptied.
 */
export async function startRound(
  dependencies: RoundDependencies,
  request: RoundRequest,
): Promise<RoundOutcome> {
  const sourced = await sourceArticle(dependencies, request.topic);

  if (!sourced.ok) {
    // C4.5 — the calls are written even though nothing came of them: a failed
    // generation is billed, and dropping the record is what makes the cost of
    // failure invisible today.
    await recordLlmCalls(dependencies.db, sourced.calls, null);
    return { ok: false, ...REFUSAL[sourced.reason] };
  }

  const { entry, fromCache, calls } = sourced.value;

  const started = await createGame(dependencies.db, {
    mode: 'solo',
    topic: entry.article.topic,
    sourceUrl: entry.article.wikipediaUrl,
    paragraphs: entry.article.paragraphs,
    timeLimit: request.timeLimit,
    fromCache,
    solution: entry.solution,
    players: [request.player],
  });

  // After the game exists, so the calls carry the game they produced: "what did
  // this round cost" is a query rather than a reconciliation.
  await recordLlmCalls(dependencies.db, calls, started.gameId);

  return {
    ok: true,
    value: {
      sessionId: started.gameId,
      timeLimit: request.timeLimit,
      // Spread from `article`, which is the `articleView` shape and nothing more.
      // The solution is in `entry.solution`, and it is not mentioned here.
      ...entry.article,
    },
  };
}
