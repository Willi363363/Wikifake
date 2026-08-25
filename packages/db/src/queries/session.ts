// What a round in progress reads and writes, between its start and its end.
//
// C1.1 again, from the other side. `queries/game.ts` keeps `game_position` out
// of the reads a player's view is built from; here two queries do touch it,
// because a hint has to come from somewhere — and they are deliberately narrow.
// `selectHintFor` returns **one** position, the one that was asked for, so a
// hint request cannot load the rest of the solution even by accident;
// `selectFalsifiedIndices` returns indices and no text at all.
//
// The alternative was calling `selectSolution` mid-round. That query exists for
// the debrief, its comment says "read once the round is over, and nowhere
// before", and a route that contradicted it would leave the next reader with a
// guarantee they cannot trust.
import { and, asc, eq, isNotNull } from 'drizzle-orm';

import type { Database } from '../client.js';
import { hintPurchase, itemUse } from '../schema/audit.js';
import { game, gamePosition, participant } from '../schema/game.js';

type Db = Database['db'];

/**
 * The participant this account or guest plays as, in this game.
 *
 * This is the authorisation query. The session handle a client sends is the
 * game's own identifier and is not a secret: what decides whether a caller may
 * buy a hint is whether they have a row here, which comes from their session
 * cookie and not from anything they typed.
 */
export function selectParticipantFor(db: Db, gameId: string, userId: string) {
  return db
    .select({
      id: participant.id,
      colour: participant.colour,
      submittedAt: participant.submittedAt,
    })
    .from(participant)
    .where(and(eq(participant.gameId, gameId), eq(participant.userId, userId)));
}

/** Whether the round is still open, and how long it was meant to last. */
export function selectRoundStatus(db: Db, gameId: string) {
  return db
    .select({
      id: game.id,
      timeLimit: game.timeLimit,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
    })
    .from(game)
    .where(eq(game.id, gameId));
}

/**
 * C1.4 — one falsification, by number. The narrowest read of the solution there
 * is.
 *
 * Shaped as a `FalsifiedPosition` because that is what the hint rules take. The
 * falsified statement comes with it and costs nothing: it is the paragraph the
 * player is already reading.
 */
export function selectHintFor(db: Db, gameId: string, falseInfoNumber: number) {
  return db
    .select({
      paragraphIndex: gamePosition.paragraphIndex,
      falseInfoNumber: gamePosition.falseInfoNumber,
      falseStatement: gamePosition.falseStatement,
      explanation: gamePosition.explanation,
      hint: gamePosition.hint,
    })
    .from(gamePosition)
    .where(
      and(
        eq(gamePosition.gameId, gameId),
        eq(gamePosition.falseInfoNumber, falseInfoNumber),
      ),
    );
}

/**
 * C1.6 — which paragraphs are falsified, and nothing about why.
 *
 * The SCANNER needs the set to choose from. It does not need a single character
 * of explanation or hint, so this query cannot hand any over.
 */
export function selectFalsifiedIndices(db: Db, gameId: string) {
  return db
    .select({ paragraphIndex: gamePosition.paragraphIndex })
    .from(gamePosition)
    .where(eq(gamePosition.gameId, gameId))
    .orderBy(asc(gamePosition.paragraphIndex));
}

/** C1.6 — the paragraphs the SCANNER has already pointed this player at. */
export function selectScannedParagraphs(db: Db, participantId: string) {
  return db
    .select({ paragraphIndex: itemUse.paragraphIndex })
    .from(itemUse)
    .where(
      and(
        eq(itemUse.casterId, participantId),
        eq(itemUse.itemId, 'SCANNER'),
        isNotNull(itemUse.paragraphIndex),
      ),
    )
    .orderBy(asc(itemUse.usedAt));
}

export interface BilledHint {
  readonly participantId: string;
  readonly falseInfoNumber: number;
  readonly level: number;
  readonly charged: number;
}

/**
 * C1.4 — records a level that was actually billed. Returns whether it landed.
 *
 * A request granting a level the player already held costs nothing and is not a
 * purchase: `hint_purchase_was_charged` refuses `charged = 0`, so the caller
 * must not call this for one. That is the constraint doing the work rather than
 * the caller remembering to.
 *
 * `false` means the level was **already billed**, which is the honest answer to
 * a double-click: two requests read the same empty ledger, both decide to charge,
 * and `hint_purchase_once_per_level` lets exactly one of them through. Reported
 * rather than raised, because the second caller is not wrong — the player owns
 * that level and must be served it, for free.
 */
export async function recordHintPurchase(db: Db, purchase: BilledHint): Promise<boolean> {
  const written = await db
    .insert(hintPurchase)
    .values(purchase)
    .onConflictDoNothing()
    .returning({ id: hintPurchase.id });
  return written.length > 0;
}

/**
 * C1.6 — records what the SCANNER designated. Returns whether it landed.
 *
 * `false` means this player had already been pointed at that paragraph, which
 * `item_use_designated_once` refuses to record twice. The caller re-runs the
 * choice against the fresh record rather than repeating an answer the player
 * already has.
 */
export async function recordScan(
  db: Db,
  use: {
    readonly gameId: string;
    readonly casterId: string;
    readonly paragraphIndex: number;
  },
): Promise<boolean> {
  const written = await db
    .insert(itemUse)
    .values({ ...use, itemId: 'SCANNER', targetId: null })
    .onConflictDoNothing()
    .returning({ id: itemUse.id });
  return written.length > 0;
}
