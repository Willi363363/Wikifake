// Reading the record back.
import { asc, eq } from 'drizzle-orm';

import type { Database } from '../client.js';
import { flagReport, hintPurchase, itemUse } from '../schema/audit.js';

type Db = Database['db'];

/**
 * C1.4 — one participant's purchases, in the order they happened.
 *
 * Ordered by time, because the property worth checking is a sequence: for one
 * falsification, the levels only ever go up. That is monotonicity, verifiable
 * from the record rather than from a claim about a dictionary in a process that
 * has since restarted.
 */
export function selectHintPurchases(db: Db, participantId: string) {
  return db
    .select({
      falseInfoNumber: hintPurchase.falseInfoNumber,
      level: hintPurchase.level,
      charged: hintPurchase.charged,
      purchasedAt: hintPurchase.purchasedAt,
    })
    .from(hintPurchase)
    .where(eq(hintPurchase.participantId, participantId))
    .orderBy(asc(hintPurchase.purchasedAt), asc(hintPurchase.falseInfoNumber));
}

/** Who sabotaged whom during a game, oldest first. */
export function selectItemUses(db: Db, gameId: string) {
  return db
    .select({
      casterId: itemUse.casterId,
      targetId: itemUse.targetId,
      itemId: itemUse.itemId,
      usedAt: itemUse.usedAt,
    })
    .from(itemUse)
    .where(eq(itemUse.gameId, gameId))
    .orderBy(asc(itemUse.usedAt));
}

/** Reports waiting on a human, oldest first: a triage queue reads bottom-up. */
export function selectReportsToReview(db: Db) {
  return db
    .select({
      id: flagReport.id,
      articleTitle: flagReport.articleTitle,
      flaggedClaim: flagReport.flaggedClaim,
      proposedCorrection: flagReport.proposedCorrection,
      verdict: flagReport.verdict,
      confidence: flagReport.confidence,
      createdAt: flagReport.createdAt,
    })
    .from(flagReport)
    .where(eq(flagReport.status, 'pending_human_review'))
    .orderBy(asc(flagReport.createdAt));
}

/**
 * Whether a sequence of purchases is monotonic per falsification.
 *
 * Here rather than in `domain` because it reads a record, not a rule: `domain`
 * enforces monotonicity as it happens, and this checks the trace it left. It is
 * what makes the guarantee auditable instead of merely asserted.
 */
export function isMonotonic(
  purchases: readonly { readonly falseInfoNumber: number; readonly level: number }[],
): boolean {
  const highest = new Map<number, number>();
  for (const purchase of purchases) {
    const previous = highest.get(purchase.falseInfoNumber);
    if (previous !== undefined && purchase.level <= previous) return false;
    highest.set(purchase.falseInfoNumber, purchase.level);
  }
  return true;
}
