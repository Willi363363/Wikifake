// What an account has played, and how a guest's play becomes an account's.
//
// The point of 4.3: the game is playable without signing up, and signing up
// afterwards must not cost the player everything they did. So a guest holds an
// anonymous `user` row while they play, and these two queries move what hangs
// off it onto the real account.
import { and, desc, eq, isNotNull, ne } from 'drizzle-orm';

import type { Database } from '../client.js';
import { flagReport } from '../schema/audit.js';
import { game, participant } from '../schema/game.js';

type Db = Database['db'];

/**
 * The games an account has played, most recent first.
 *
 * C1.1 and C1.2 — no `game_position`. A history view has no business carrying
 * solutions: it is the easiest place to leak them, because a debrief and a
 * history list look alike and one of them is about games somebody else may still
 * be playing. A test asserts this query never mentions that table.
 */
export function selectGameHistory(db: Db, userId: string) {
  return db
    .select({
      gameId: game.id,
      topic: game.topic,
      mode: game.mode,
      sourceUrl: game.sourceUrl,
      totalFakes: game.totalFakes,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
      /** The name they played under, which an account's own name may differ from. */
      playedAs: participant.guestName,
      score: participant.score,
      truePositives: participant.truePositives,
      falsePositives: participant.falsePositives,
      submittedAt: participant.submittedAt,
    })
    .from(participant)
    .innerJoin(game, eq(participant.gameId, game.id))
    .where(eq(participant.userId, userId))
    .orderBy(desc(game.startedAt));
}

/** Every read that must never touch the solution. Asserted, not trusted. */
export const HISTORY_QUERIES = [selectGameHistory] as const;

export interface Attachment {
  readonly participants: number;
  readonly flagReports: number;
}

/**
 * Moves everything a guest did onto the account they just created.
 *
 * Called from Better Auth's `onLinkAccount`, which runs **before** the plugin
 * deletes the anonymous row — verified in the plugin's source, not assumed. The
 * order matters twice over: after the delete the rows would be unreachable, and
 * `participant.userId` is `set null` on delete, so a row still pointing at the
 * anonymous user would come out belonging to nobody.
 *
 * Answers, hint purchases and item uses need no work: they hang off
 * `participant`, so moving the participant carries them.
 */
export async function attachGuestRecords(
  db: Db,
  fromUserId: string,
  toUserId: string,
): Promise<Attachment> {
  // Refusing rather than quietly doing nothing: being asked to attach an account
  // to itself means a caller has confused two ids, and the loss would be silent.
  if (fromUserId === toUserId) {
    throw new Error('attachGuestRecords: the guest and the account are the same user');
  }

  const participants = await db
    .update(participant)
    .set({ userId: toUserId })
    .where(eq(participant.userId, fromUserId))
    .returning({ id: participant.id });

  // Their reports follow them too. `reporterId` is `set null` on delete, so
  // leaving these behind loses the author without failing anything — the quiet
  // kind of data loss.
  const reports = await db
    .update(flagReport)
    .set({ reporterId: toUserId })
    .where(eq(flagReport.reporterId, fromUserId))
    .returning({ id: flagReport.id });

  return { participants: participants.length, flagReports: reports.length };
}

/** Games played by an account, for the negative assertion above to have a subject. */
export function selectPlayedGameIds(db: Db, userId: string) {
  return db
    .selectDistinct({ gameId: participant.gameId })
    .from(participant)
    .where(and(eq(participant.userId, userId), isNotNull(participant.gameId)));
}

/** Participants of a game that are not this account: the other players. */
export function selectOtherParticipants(db: Db, gameId: string, userId: string) {
  return db
    .select({ id: participant.id, playedAs: participant.guestName })
    .from(participant)
    .where(and(eq(participant.gameId, gameId), ne(participant.userId, userId)));
}
