// Filling a database, twice, with the same result.
//
// Idempotent by construction rather than by cleverness: every row has a fixed
// identifier, and every insert is `onConflictDoNothing` on that identifier. So a
// second run is a no-op, and a run against a half-filled database completes it
// instead of failing.
//
// The alternative — delete everything, then insert — is destructive on a
// database somebody is developing against, and would take their own rows with
// it.
import type { Database } from '../client.js';
import {
  answer,
  flagReport,
  game,
  gamePosition,
  hintPurchase,
  itemUse,
  llmCall,
  participant,
  profile,
  room,
  user,
} from '../schema/index.js';
import {
  SEED_ANSWERS,
  SEED_FLAG_REPORT,
  SEED_GAME,
  SEED_HINT_PURCHASES,
  SEED_ITEM_USES,
  SEED_LLM_CALLS,
  SEED_PARTICIPANTS,
  SEED_POSITIONS,
  SEED_PROFILES,
  SEED_ROOM,
  SEED_USERS,
} from './data.js';

/**
 * Fills the database with a room, a finished game and everything it produced.
 *
 * In one transaction: a seed that fails halfway leaves a database that looks
 * seeded and is not, which is worse than one that is empty.
 */
export async function seed(db: Database['db']): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(user)
      .values([...SEED_USERS])
      .onConflictDoNothing();
    await tx
      .insert(profile)
      .values([...SEED_PROFILES])
      .onConflictDoNothing();
    await tx.insert(room).values(SEED_ROOM).onConflictDoNothing();
    await tx.insert(game).values(SEED_GAME).onConflictDoNothing();
    await tx
      .insert(gamePosition)
      .values([...SEED_POSITIONS])
      .onConflictDoNothing();
    await tx
      .insert(participant)
      .values([...SEED_PARTICIPANTS])
      .onConflictDoNothing();
    await tx
      .insert(answer)
      .values([...SEED_ANSWERS])
      .onConflictDoNothing();
    await tx
      .insert(hintPurchase)
      .values([...SEED_HINT_PURCHASES])
      .onConflictDoNothing();
    await tx
      .insert(itemUse)
      .values([...SEED_ITEM_USES])
      .onConflictDoNothing();
    await tx
      .insert(llmCall)
      .values([...SEED_LLM_CALLS])
      .onConflictDoNothing();
    await tx.insert(flagReport).values(SEED_FLAG_REPORT).onConflictDoNothing();
  });
}
