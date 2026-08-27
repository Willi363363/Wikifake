// Reading a game, before and after it ends.
//
// C1.1 — the whole point of the split. A game in progress is read by queries
// that do not mention `game_position`, so there is no join to forget to leave
// out and no column to forget to omit. The convenient join that embeds the
// solution "for later" is exactly the leak the contract forbids, and
// `game.test.ts` asserts on the generated SQL that it is not there.
//
// The queries are returned rather than awaited, so a caller can inspect one —
// and so a test can read the SQL a query will actually send.
import { eq } from 'drizzle-orm';

import type { Database } from '../client.js';
import { answer, game, gamePosition, participant } from '../schema/game.js';

type Db = Database['db'];

/**
 * C1.1 — the article as a round may see it: what a player reads, and how many
 * falsifications there are. Never which ones.
 *
 * The selected columns are listed rather than taken wholesale: `select()` with
 * no argument returns whatever the table grows next, and the next column could
 * be one of these.
 */
export function selectGameInProgress(db: Db, gameId: string) {
  return db
    .select({
      id: game.id,
      mode: game.mode,
      roomCode: game.roomCode,
      topic: game.topic,
      sourceUrl: game.sourceUrl,
      paragraphs: game.paragraphs,
      totalFakes: game.totalFakes,
      timeLimit: game.timeLimit,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
    })
    .from(game)
    .where(eq(game.id, gameId));
}

/**
 * Who is in the game, and whether they have submitted.
 *
 * The score columns are deliberately absent: during a round a rival's real
 * score is information about the solution, which is why the live score on the
 * wire is optimistic in the first place.
 */
export function selectParticipantsInProgress(db: Db, gameId: string) {
  return db
    .select({
      id: participant.id,
      userId: participant.userId,
      guestName: participant.guestName,
      colour: participant.colour,
      submittedAt: participant.submittedAt,
    })
    .from(participant)
    .where(eq(participant.gameId, gameId));
}

/** C1.2 — the solution. Read once the round is over, and nowhere before. */
export function selectSolution(db: Db, gameId: string) {
  return (
    db
      .select({
        paragraphIndex: gamePosition.paragraphIndex,
        falseInfoNumber: gamePosition.falseInfoNumber,
        falseStatement: gamePosition.falseStatement,
        originalText: gamePosition.originalText,
        explanation: gamePosition.explanation,
        hint: gamePosition.hint,
      })
      .from(gamePosition)
      .where(eq(gamePosition.gameId, gameId))
      // C3.3 — ascending paragraph index, which is also the order the debrief
      // lists them in.
      .orderBy(gamePosition.paragraphIndex)
  );
}

/** C2.4 — the final standings, highest score first. */
export function selectLeaderboard(db: Db, gameId: string) {
  return db
    .select({
      id: participant.id,
      userId: participant.userId,
      guestName: participant.guestName,
      colour: participant.colour,
      score: participant.score,
      truePositives: participant.truePositives,
      falsePositives: participant.falsePositives,
      hintsUsed: participant.hintsUsed,
      hintPenalty: participant.hintPenalty,
      scoreStolen: participant.scoreStolen,
      timeBonus: participant.timeBonus,
    })
    .from(participant)
    .where(eq(participant.gameId, gameId));
}

/** What one participant marked, in ascending paragraph order. */
export function selectAnswers(db: Db, participantId: string) {
  return db
    .select({ paragraphIndex: answer.paragraphIndex })
    .from(answer)
    .where(eq(answer.participantId, participantId))
    .orderBy(answer.paragraphIndex);
}

/** The queries a round in progress is allowed to run. Read by the leak test. */
export const IN_PROGRESS_QUERIES = [
  selectGameInProgress,
  selectParticipantsInProgress,
] as const;
