// Taking an account's data out, and taking the account away — step E.7.
//
// Built while the schema is small. The track's own argument: this is an hour's
// work today and a week's once quests, coins and leaderboards reference a
// player, and every one of those is a table that would have to learn what a
// deletion means.
//
// **The delete does not work by itself, and that is what this step found.**
// Every reference to `user` is already declared `cascade` or `set null`, so
// `delete from "user"` looks like the whole job. It is not: `participant`
// carries `participant_account_or_guest`, a check that a row names *either* an
// account or a guest, and a solo round played by a signed-in player has a
// `userId` and no `guestName` — `identify` never sets one. Setting the id null
// leaves a row that is neither, the check fires, and **the whole delete
// aborts**. Reproduced against Postgres before a line of this was written.
//
// So a name goes in before the account goes out. Which is also what the plan
// asks for in its own words: a finished room keeps its scores, attributed to a
// deleted player.
import { desc, eq } from 'drizzle-orm';

import type { Database } from '../client.js';
import { flagReport } from '../schema/audit.js';
import { game, participant } from '../schema/game.js';
import { profile } from '../schema/profile.js';
import { user } from '../schema/auth.js';
import { selectGameHistory } from './history.js';
import { selectPlayerStats, type PlayerStats } from './stats.js';

/**
 * A connection **or** a transaction, for the write below.
 *
 * The read does not take one: `exportAccount` composes `selectGameHistory`,
 * which is typed to a connection, and an export has no business inside a
 * transaction — it is a snapshot of rows nothing is changing.
 */
type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type Db = Database['db'] | Tx;

/** Everything this application holds about one account. */
export interface AccountExport {
  readonly account: {
    readonly email: string;
    readonly createdAt: Date;
  };
  /** Null for an account that never chose a pseudonym — E.3.2's other state. */
  readonly profile: {
    readonly pseudonym: string;
    readonly accent: string;
    readonly preferences: unknown;
  } | null;
  /** Null for an account that has never joined a round. */
  readonly stats: PlayerStats | null;
  readonly games: Awaited<ReturnType<typeof selectGameHistory>>;
  readonly reports: {
    readonly articleTitle: string;
    readonly flaggedClaim: string;
    readonly proposedCorrection: string;
    readonly quickNote: string;
    readonly explanation: string;
    readonly createdAt: Date;
  }[];
}

/**
 * Everything this application holds about one account, as one object.
 *
 * **Composed from the queries that already exist**, not written afresh: the
 * games are `selectGameHistory`'s and the aggregate is `selectPlayerStats`', so
 * an export shows a player the same numbers their profile does. A second
 * implementation would be a second set of numbers to disagree.
 *
 * What is deliberately *not* here: the session and provider rows. A hashed
 * password and an OAuth refresh token are data *about* this account, and handing
 * them to whoever is holding the browser is a credential leak wearing the word
 * "export". The right of access is to the data, and the token is not it.
 *
 * The `id` is not here either. It appears nowhere a player can act on and
 * nothing outside this database means anything by it.
 */
export async function exportAccount(
  db: Database['db'],
  userId: string,
): Promise<AccountExport | null> {
  const [account] = await db
    .select({ email: user.email, createdAt: user.createdAt })
    .from(user)
    .where(eq(user.id, userId));

  // Not an empty export: an id with no account is a caller asking about
  // somebody who is not there, and answering `{}` would look like an account
  // that holds nothing.
  if (account === undefined) return null;

  const [chosen] = await db
    .select({
      pseudonym: profile.displayName,
      accent: profile.accent,
      preferences: profile.preferences,
    })
    .from(profile)
    .where(eq(profile.userId, userId));

  const reports = await db
    .select({
      articleTitle: flagReport.articleTitle,
      flaggedClaim: flagReport.flaggedClaim,
      proposedCorrection: flagReport.proposedCorrection,
      quickNote: flagReport.quickNote,
      explanation: flagReport.explanation,
      createdAt: flagReport.createdAt,
    })
    .from(flagReport)
    .where(eq(flagReport.reporterId, userId))
    .orderBy(desc(flagReport.createdAt));

  return {
    account,
    profile: chosen ?? null,
    stats: await selectPlayerStats(db, userId),
    games: await selectGameHistory(db, userId),
    reports,
  };
}

/** What a deletion came to, so a caller can say more than "done". */
export interface Deletion {
  /** Rounds whose player is now a name nothing links back. */
  readonly participants: number;
  /** Reports that keep their content and lose their author. */
  readonly reports: number;
}

/**
 * Removes the account, and leaves the games it played coherent.
 *
 * In one transaction, because the two halves are one act: an anonymisation that
 * committed without its delete would be an account whose rounds had been
 * stripped of their name and which still existed.
 *
 * **`placeholder` is the caller's**, and injected rather than generated here for
 * the reason `isPerfectRound` is: a test that cannot pin it can only assert that
 * *something* was written. It must be a name a room could have shown — the
 * column is rendered in a debrief and read by `selectGameHistory` — so the layer
 * that owns `playerName` is the layer that should mint one.
 *
 * **Every participant row is renamed, not only the nameless ones.** Since E.3.3
 * a signed-in player's room rounds carry their *pseudonym* in `guestName`, so
 * leaving those alone would delete an account and leave its public name in every
 * room it ever played. The nameless ones are the solo rounds, and they are the
 * ones that would abort the delete.
 *
 * Sessions, provider links, the profile and the aggregate need no work: they are
 * `cascade`, which is the schema saying they have no meaning without the row
 * above them. Reports are `set null`, which is the schema saying the opposite —
 * a report is about an article, and it outlives the reader who filed it.
 */
export async function deleteAccount(
  db: Db,
  userId: string,
  placeholder: string,
): Promise<Deletion> {
  const renamed = await db
    .update(participant)
    .set({ guestName: placeholder })
    .where(eq(participant.userId, userId))
    .returning({ id: participant.id });

  // Counted before the delete, because after it there is nothing to count: the
  // rows survive with a null author and no way back to the id they had.
  const reports = await db
    .select({ id: flagReport.id })
    .from(flagReport)
    .where(eq(flagReport.reporterId, userId));

  await db.delete(user).where(eq(user.id, userId));

  return { participants: renamed.length, reports: reports.length };
}

/** Games this account played, for a test to look at after it is gone. */
export function selectParticipantsOf(db: Db, gameId: string) {
  return db
    .select({
      userId: participant.userId,
      guestName: participant.guestName,
      score: participant.score,
    })
    .from(participant)
    .innerJoin(game, eq(participant.gameId, game.id))
    .where(eq(game.id, gameId));
}
