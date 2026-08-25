// Starting a game: the one write that brings a round into existence.
//
// Three tables in one transaction, and the transaction is the point. A `game`
// without its `game_position` rows is a round nobody can be graded on; a
// `game_position` set without its `participant` is a solution belonging to
// nobody. Half of this landing is worse than none of it landing, because the
// player would already be reading the article.
//
// The shapes below are declared here rather than imported from
// `@wikifake/article`: persistence does not depend on what produces the data —
// `workspace-graph.test.ts` holds that line — and the generator's own solution
// type satisfies these structurally, so nothing is retyped at the call site.
import type { Database } from '../client.js';
import { game, gamePosition, participant } from '../schema/game.js';

type Db = Database['db'];

/** One falsification, with the paragraph it replaced. C1.2 plus the audit trail. */
export interface NewPosition {
  /** C3.3 — 1-based. */
  readonly paragraphIndex: number;
  readonly falseInfoNumber: number;
  readonly falseStatement: string;
  readonly originalText: string;
  readonly explanation: string;
  readonly hint: string;
}

/**
 * Who is playing, from the moment the round starts.
 *
 * Both fields are optional and the table's check requires at least one: an
 * account has a `userId`, a guest has an anonymous one, and a nickname is the
 * name shown for this game rather than an identity.
 */
export interface NewParticipant {
  readonly userId?: string | null;
  readonly guestName?: string | null;
  readonly colour: string;
}

export interface NewGame {
  readonly mode: 'solo' | 'multiplayer';
  /** Null in solo: there is no room. */
  readonly roomCode?: string | null;
  readonly topic: string;
  readonly sourceUrl: string;
  readonly paragraphs: readonly string[];
  readonly timeLimit: number;
  /** C4.6 — whether the article was reused rather than generated. */
  readonly fromCache: boolean;
  readonly solution: readonly NewPosition[];
  readonly players: readonly NewParticipant[];
}

export interface StartedGame {
  readonly gameId: string;
  /** In the order the participants were given, so a caller can find its own. */
  readonly participantIds: readonly string[];
}

/**
 * Writes a round and returns its identifiers.
 *
 * `totalFakes` is **derived** from the solution rather than accepted as a
 * parameter. C1.1 says the start payload carries the count and nothing else, so
 * the count is the one thing about the solution a player is told — and a caller
 * free to pass its own could tell them there are three fakes in a round that has
 * four, which no constraint in the schema would catch.
 */
export async function createGame(db: Db, input: NewGame): Promise<StartedGame> {
  if (input.solution.length === 0) {
    throw new Error('createGame: a round with no falsification is not playable');
  }
  if (input.players.length === 0) {
    throw new Error('createGame: a round with nobody in it is not playable');
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(game)
      .values({
        mode: input.mode,
        roomCode: input.roomCode ?? null,
        topic: input.topic,
        sourceUrl: input.sourceUrl,
        paragraphs: [...input.paragraphs],
        totalFakes: input.solution.length,
        timeLimit: input.timeLimit,
        fromCache: input.fromCache,
      })
      .returning({ id: game.id });

    // `returning` is typed as a list because a bulk insert returns one: a single
    // row is still an assumption, and an unchecked index would surface three
    // lines later as a foreign key violation that says nothing about the cause.
    if (row === undefined) throw new Error('createGame: the game was not inserted');

    await tx
      .insert(gamePosition)
      .values(input.solution.map((position) => ({ ...position, gameId: row.id })));

    const participants = await tx
      .insert(participant)
      .values(
        input.players.map((player) => ({
          gameId: row.id,
          userId: player.userId ?? null,
          guestName: player.guestName ?? null,
          colour: player.colour,
        })),
      )
      .returning({ id: participant.id });

    return { gameId: row.id, participantIds: participants.map((each) => each.id) };
  });
}
