// Claiming a pseudonym, and reading the one an account holds — step E.3.1.
//
// `profile.displayName` has existed since phase 2 and nothing but the seed has
// ever written it. This is the step that makes it real, and the one rule it adds
// is that **no two accounts hold the same pseudonym**.
//
// **Not `user.name`**, which is where E.2 put it and where it cannot stay. That
// column belongs to Better Auth, and Better Auth writes it itself: a Google
// sign-in fills it from the provider's profile, without asking. A unique index
// there would turn "two people called Marie Dupont signed in with Google" into a
// database error raised inside a library, on a path this repository does not own
// — and the value it collided on would be a legal name rather than a chosen one.
// `profile` is ours, its rows are created by the code below, and a refusal here
// is a sentence rather than a stack trace.
//
// **The constraint is the check, and there is no check before it.** Reading
// "is this pseudonym free?" and then inserting is two statements, and two
// sign-ups racing for the same name both read *free*. So the insert is the
// question: Postgres answers it once, under a lock nothing in this process can
// see around, and a unique violation comes back as a refusal rather than as a
// thrown error the caller has to know the SQLSTATE of.
import { eq } from 'drizzle-orm';
import { pseudonymKey } from '@wikifake/protocol';

import type { Database } from '../client.js';
import { profile } from '../schema/profile.js';
import { SQLSTATE, sqlstate } from '../sqlstate.js';

/**
 * A connection **or** a transaction.
 *
 * The same alias `queries/stats.ts` declares, and for the same reason: a claim
 * belongs inside whatever transaction created the account, and drizzle's
 * transaction handle is not a `PostgresJsDatabase`.
 */
type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type Db = Database['db'] | Tx;

/** The pseudonym an account holds, as stored and as compared. */
export interface Pseudonym {
  /** What other players see, with the capitals its owner typed. */
  readonly displayName: string;
  /** The folded form the uniqueness rule is decided on. */
  readonly displayNameKey: string;
}

/**
 * What a claim came to.
 *
 * A discriminated union rather than a boolean, so that the day a claim can fail
 * for a second reason the callers stop compiling instead of reading `false` as
 * "taken".
 */
export type Claim =
  | { readonly ok: true; readonly pseudonym: Pseudonym }
  | { readonly ok: false; readonly reason: 'taken' };

/**
 * Gives an account the pseudonym it asked for, if nobody else holds it.
 *
 * The row is created here and only here, so a `profile` row *is* a pseudonym
 * that has been chosen — which is what lets the step after this one recognise
 * an account that has not chosen yet by the absence of one.
 *
 * The name is stored as it was typed and keyed as it folds, in one statement:
 * the two can never be written apart, so no row can exist whose key is not its
 * own name's.
 *
 * Only a unique violation is turned into a refusal. A foreign key violation —
 * a claim for a `userId` that is not an account — stays an error, because it is
 * a bug in the caller and not something a player can retype their way out of.
 */
export async function claimPseudonym(
  db: Db,
  userId: string,
  displayName: string,
): Promise<Claim> {
  const pseudonym: Pseudonym = {
    displayName,
    displayNameKey: pseudonymKey(displayName),
  };

  try {
    await db.insert(profile).values({ userId, ...pseudonym });
  } catch (error) {
    if (sqlstate(error) !== SQLSTATE.uniqueViolation) throw error;
    return { ok: false, reason: 'taken' };
  }

  return { ok: true, pseudonym };
}

/**
 * The pseudonym this account chose, or null for one that has not chosen.
 *
 * Null is a real answer and not an error: an account created through Google has
 * no profile row until somebody picks a name for it, and E.3.2 is the screen
 * that asks. Anything rendering a player has to handle it either way.
 */
export async function selectPseudonym(db: Db, userId: string): Promise<Pseudonym | null> {
  const rows = await db
    .select({
      displayName: profile.displayName,
      displayNameKey: profile.displayNameKey,
    })
    .from(profile)
    .where(eq(profile.userId, userId));

  return rows[0] ?? null;
}
