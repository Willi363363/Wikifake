// Answering `generate_article`: a topic in, a round or a failure out.
//
// This is the piece that was missing. `generate_article` is an effect the
// reducer emits and nothing in this service answered, and `article_ready` is the
// only way into a round (D3) — so until now a multiplayer round could not start
// at all.
//
// The chain itself is not here. `sourceArticle` lives in `@wikifake/article`,
// where the cache, the MediaWiki client and the falsification already live, and
// the solo route uses the same one: two copies of "how a round gets its article"
// would be two answers to C3.7 and C4.5 with nothing making them agree.
//
// What *is* here is what multiplayer adds to it — the row. A round that writes
// no `game` is not merely missing from the history: C4.6 counts its model calls
// in the numerator of `perGeneratedGame` and its round nowhere in the
// denominator, so every multiplayer generation would quietly inflate the cost
// per game.
import { sourceArticle, type SourceDependencies } from '@wikifake/article';
import { createGame, recordLlmCalls, type Database } from '@wikifake/db';
import type { ArticleView, FalsifiedPosition } from '@wikifake/protocol';

/** Who is in the room when the round starts, as the roster knows them. */
export interface RoundPlayer {
  readonly name: string;
  readonly colour: string;
}

export interface RoundRequest {
  readonly roomCode: string;
  readonly topic: string;
  readonly timeLimit: number;
  readonly players: readonly RoundPlayer[];
}

/**
 * A round to start, or nothing.
 *
 * Nothing carries no reason. The room's answer to every failure is the same —
 * try the next candidate, and fall back to the lobby when the queue runs out
 * (C3.7) — so a reason here would be a distinction the caller cannot act on.
 * What the failure *was* is recorded where it belongs, in `llm_call`.
 */
export type RoundOutcome =
  | {
      readonly ok: true;
      readonly article: ArticleView;
      readonly solution: readonly FalsifiedPosition[];
    }
  | { readonly ok: false };

/**
 * Where a room's article comes from.
 *
 * A port rather than the implementation, because the service that calls it must
 * be testable without Wikipedia, a model or a database — and because "the model
 * and Wikipedia mocked" is what the step's own criterion asks for.
 */
export interface RoundSource {
  open(request: RoundRequest): Promise<RoundOutcome>;
}

export interface GenerationDependencies extends SourceDependencies {
  readonly db: Database['db'];
}

/** The real one: cache, Wikipedia, model, then a row. */
export function createRoundSource(dependencies: GenerationDependencies): RoundSource {
  return {
    async open(request) {
      const sourced = await sourceArticle(dependencies, request.topic);

      if (!sourced.ok) {
        // C4.5 — a failed generation is billed and recorded, and becomes no
        // game. Dropping the record is what makes the cost of failure invisible
        // today.
        await recordLlmCalls(dependencies.db, sourced.calls, null);
        return { ok: false };
      }

      const { entry, fromCache, calls } = sourced.value;

      const started = await createGame(dependencies.db, {
        mode: 'multiplayer',
        roomCode: request.roomCode,
        topic: entry.article.topic,
        sourceUrl: entry.article.wikipediaUrl,
        paragraphs: entry.article.paragraphs,
        timeLimit: request.timeLimit,
        fromCache,
        solution: entry.solution,
        // A nickname, not an account: a room is played by whoever typed a name.
        // Linking a signed-in player's rounds is `attachGuestRecords`' business.
        players: request.players.map((player) => ({
          guestName: player.name,
          colour: player.colour,
        })),
      });

      // After the game exists, so the calls carry the game they produced: "what
      // did this round cost" is a query rather than a reconciliation.
      await recordLlmCalls(dependencies.db, calls, started.gameId);

      return { ok: true, article: entry.article, solution: entry.solution };
    },
  };
}
