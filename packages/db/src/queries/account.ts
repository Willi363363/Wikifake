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
import { admin } from '../schema/admin.js';
import { coinMovement } from '../schema/coins.js';
import { flagReport, hintPurchase, itemUse } from '../schema/audit.js';
import { game, participant } from '../schema/game.js';
import { leaderboardEntry } from '../schema/leaderboard.js';
import { profile } from '../schema/profile.js';
import { questAssignment } from '../schema/quests.js';
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

/**
 * Every table that holds something about a player, and what the export does
 * with it — step J.11.
 *
 * **The reason this exists is that the export fell three tracks behind and
 * nothing said so.** E.7 wrote it when the schema had five tables; F, G and H
 * added coins, quests, hint purchases, item uses and leaderboard entries, and
 * every one of them was missing from what a player could download. A right of
 * access that silently stops covering new data is worse than one nobody built,
 * because the gap is invisible from the outside.
 *
 * `account.export.test.ts` reads the schema directory, finds every table that
 * references a `user` or a `participant`, and holds it to appearing here. A
 * table added without a line fails that test — which is the only way this list
 * stays true, since the alternative is somebody remembering.
 */
export const EXPORT_COVERAGE: Readonly<Record<string, string>> = {
  // Exported, and the key in `AccountExport` that carries it.
  user: 'account',
  profile: 'profile',
  player_stats: 'stats',
  game: 'games',
  participant: 'games',
  answer: 'games',
  flag_report: 'reports',
  coin_movement: 'coins',
  quest_assignment: 'quests',
  leaderboard_entry: 'boards',
  hint_purchase: 'hints',
  item_use: 'items',
  admin: 'account.administrator',

  /*
   * Not exported, with the reason. Each of these is a deliberate refusal rather
   * than an oversight, which is the distinction this map exists to keep.
   */
  account:
    'exempt: a hashed password and OAuth tokens are credentials, and an export is not a way to hand them over',
  session:
    'exempt: a session token is a credential; the rows expire on their own and name no act of the player',
  verification:
    'exempt: keyed by email address rather than by account, and holds a short-lived token',
  room: 'exempt: a room belongs to the players in it, and what this player did in one is their participation',
  game_position:
    'exempt: where a paragraph sat in an article, which is about the article',
};

/** Everything this application holds about one account. */
export interface AccountExport {
  readonly account: {
    readonly email: string;
    readonly name: string;
    readonly emailVerified: boolean;
    /** What the provider sent, where one did. Null otherwise. */
    readonly image: string | null;
    readonly createdAt: Date;
    /** Step J.11 — a role granted by the operator is still a fact about them. */
    readonly administrator: boolean;
  };
  /** Null for an account that never chose a pseudonym — E.3.2's other state. */
  readonly profile: {
    readonly pseudonym: string;
    readonly accent: string;
    /**
     * G.1's two, and the distinction is the point: one was derived from the
     * network the request came over, the other the player set themselves. An
     * export that showed only the effective one would hide which.
     */
    readonly derivedRegion: string | null;
    readonly chosenRegion: string | null;
    /** H.6 — what they are wearing, which is three columns rather than a table. */
    readonly wornMarker: string | null;
    readonly wornMarkStyle: string | null;
    readonly wornFrame: string | null;
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
  /**
   * H.1's ledger, and the balance it comes to.
   *
   * Every movement rather than the total: a balance is a number a player can
   * dispute and a ledger is what answers them. `reference` is what the movement
   * was for — a quest's rule, a cosmetic's identifier, a round's id.
   */
  readonly coins: {
    readonly balance: number;
    readonly movements: {
      readonly amount: number;
      readonly source: string;
      readonly reference: string | null;
      readonly balanceAfter: number;
      readonly createdAt: Date;
    }[];
  };
  /**
   * F.3's assignments, claimed or not.
   *
   * No progress figure, because there is no progress column: F.4 counts it
   * where the rules live, from the rounds this file already exports. An export
   * that invented one would be a second implementation of the count.
   */
  readonly quests: {
    readonly period: string;
    readonly periodIndex: number;
    readonly ruleId: string;
    readonly target: number;
    readonly assignedAt: Date;
    readonly claimedAt: Date | null;
  }[];
  /** G.2's entries: the scores a board may rank, whether or not one did. */
  readonly boards: {
    readonly mode: string;
    readonly score: number;
    readonly finishedAt: Date;
  }[];
  /** H.4 — hints bought during a round, and what each cost. */
  readonly hints: {
    readonly falseInfoNumber: number;
    readonly level: number;
    readonly charged: number;
    readonly purchasedAt: Date;
  }[];
  /** 8.9 — items spent in a room, and whom on. */
  readonly items: {
    readonly itemId: string;
    readonly onSomebodyElse: boolean;
    readonly usedAt: Date;
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
    .select({
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt,
    })
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
      derivedRegion: profile.derivedRegion,
      chosenRegion: profile.chosenRegion,
      wornMarker: profile.wornMarker,
      wornMarkStyle: profile.wornMarkStyle,
      wornFrame: profile.wornFrame,
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

  /*
   * Step J.11 — the four tracks that arrived after E.7 wrote this.
   *
   * In parallel because they share nothing: six reads against six tables, none
   * of which is a subquery of another. `hints` and `items` are the two that do
   * not key on the account at all — they key on a *participation*, so they are
   * joined back through `participant`, which is how they were invisible to the
   * first version of this function.
   */
  const [movements, quests, boards, hints, items, role] = await Promise.all([
    db
      .select({
        amount: coinMovement.amount,
        source: coinMovement.source,
        reference: coinMovement.reference,
        balanceAfter: coinMovement.balanceAfter,
        createdAt: coinMovement.createdAt,
      })
      .from(coinMovement)
      .where(eq(coinMovement.userId, userId))
      .orderBy(desc(coinMovement.createdAt)),

    db
      .select({
        period: questAssignment.period,
        periodIndex: questAssignment.periodIndex,
        ruleId: questAssignment.ruleId,
        target: questAssignment.target,
        assignedAt: questAssignment.assignedAt,
        claimedAt: questAssignment.claimedAt,
      })
      .from(questAssignment)
      .where(eq(questAssignment.userId, userId))
      .orderBy(desc(questAssignment.assignedAt)),

    db
      .select({
        mode: leaderboardEntry.mode,
        score: leaderboardEntry.score,
        finishedAt: leaderboardEntry.finishedAt,
      })
      .from(leaderboardEntry)
      .where(eq(leaderboardEntry.userId, userId))
      .orderBy(desc(leaderboardEntry.finishedAt)),

    db
      .select({
        falseInfoNumber: hintPurchase.falseInfoNumber,
        level: hintPurchase.level,
        charged: hintPurchase.charged,
        purchasedAt: hintPurchase.purchasedAt,
      })
      .from(hintPurchase)
      .innerJoin(participant, eq(hintPurchase.participantId, participant.id))
      .where(eq(participant.userId, userId))
      .orderBy(desc(hintPurchase.purchasedAt)),

    db
      .select({
        itemId: itemUse.itemId,
        targetId: itemUse.targetId,
        usedAt: itemUse.usedAt,
      })
      .from(itemUse)
      .innerJoin(participant, eq(itemUse.casterId, participant.id))
      .where(eq(participant.userId, userId))
      .orderBy(desc(itemUse.usedAt)),

    db.select({ userId: admin.userId }).from(admin).where(eq(admin.userId, userId)),
  ]);

  return {
    account: { ...account, administrator: role.length > 0 },
    profile: chosen ?? null,
    stats: await selectPlayerStats(db, userId),
    games: await selectGameHistory(db, userId),
    reports,
    coins: {
      // Summed from the movements already read rather than asked for again: a
      // second query is a second answer, and the two would disagree the moment
      // a round settled between them.
      balance: movements.reduce((total, movement) => total + movement.amount, 0),
      movements,
    },
    quests,
    boards,
    hints,
    // The target is another player's participation id, which means nothing
    // outside this database and names somebody else. Whether there *was* one is
    // the part that is about this player.
    items: items.map(({ itemId, targetId, usedAt }) => ({
      itemId,
      onSomebodyElse: targetId !== null,
      usedAt,
    })),
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
