// A score that is eligible to be ranked — step G.2, against a real Postgres.
//
// The table was chosen over deriving the boards, and the cost named at the time
// was a second write path that can drift from `participant`. **This file is how
// that cost is paid.** Rounds go in through `recordSubmission` — the real path,
// transaction and all — and then the table is rebuilt from the `participant`
// rows it is supposed to describe, and the two must be identical.
//
// It is the arrangement E.4 used to make `player_stats` believable, and it earns
// itself the same way: the first thing it caught was the entry being written
// only for accounts, which would have left every guest's round out of the field
// the other players were ranked against.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import {
  rebuildLeaderboard,
  recordEligibleScore,
  selectEligibleScores,
} from './leaderboard.js';
import { deleteAccount } from './account.js';
import { recordSubmission, type GradedSubmission } from './session.js';
import { game, participant } from '../schema/game.js';
import { user } from '../schema/auth.js';
import { openTestDatabase, testDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '../testing/database.js';

const url = testDatabaseUrl();
const AT = new Date('2026-09-10T12:00:00.000Z');

describe.skipIf(url === null)('G.2 — the scores a board may rank', () => {
  let store: TestDatabase;

  beforeAll(async () => {
    store = await openTestDatabase(url as string);
  });

  beforeEach(async () => {
    await store.truncate();
  });

  afterAll(async () => {
    await store.close();
  });

  const addUser = async (id: string): Promise<void> => {
    await store.db
      .insert(user)
      .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
  };

  /** A game and one participant in it, ungraded. */
  const joinGame = async (options: {
    readonly userId: string | null;
    readonly mode?: 'solo' | 'multiplayer';
    readonly guestName?: string;
  }): Promise<{ gameId: string; participantId: string }> => {
    const [row] = await store.db
      .insert(game)
      .values({
        mode: options.mode ?? 'solo',
        topic: 'Chat',
        sourceUrl: 'https://fr.wikipedia.org/wiki/Chat',
        paragraphs: ['un paragraphe'],
        totalFakes: 3,
        timeLimit: 300,
      })
      .returning({ id: game.id });
    if (row === undefined) throw new Error('no game');

    const [player] = await store.db
      .insert(participant)
      .values({
        gameId: row.id,
        ...(options.userId === null
          ? { guestName: options.guestName ?? 'a guest' }
          : { userId: options.userId }),
        colour: '#1f574d',
      })
      .returning({ id: participant.id });
    if (player === undefined) throw new Error('no participant');

    return { gameId: row.id, participantId: player.id };
  };

  const graded = (
    ids: { gameId: string; participantId: string },
    over: Partial<GradedSubmission> = {},
  ): GradedSubmission => ({
    gameId: ids.gameId,
    participantId: ids.participantId,
    marked: [1, 2, 3],
    score: 450,
    truePositives: 3,
    falsePositives: 0,
    hintsUsed: 0,
    hintPenalty: 0,
    scoreStolen: 0,
    timeBonus: 0,
    perfect: true,
    at: AT,
    ...over,
  });

  const entries = () => selectEligibleScores(store.db);

  it('writes an entry when a round is graded, in the same transaction', async () => {
    await addUser('ada');
    const ids = await joinGame({ userId: 'ada' });

    expect(await recordSubmission(store.db, graded(ids))).toBe(true);

    expect(await entries()).toEqual([
      {
        participantId: ids.participantId,
        userId: 'ada',
        mode: 'solo',
        score: 450,
        finishedAt: AT,
      },
    ]);
  });

  it('writes nothing for a round nobody submitted', async () => {
    // The whole point of the table: a row exists if and only if the server
    // graded a round. An unfinished one is ranked nowhere, which is the track's
    // exit gate.
    await addUser('ada');
    await joinGame({ userId: 'ada' });

    expect(await entries()).toEqual([]);
  });

  it('writes a guest’s round too, with no owner on it', async () => {
    /*
     * A guest is part of the field the other players were ranked against, so
     * their round is eligible even though no board will print their name — the
     * queries of G.4 skip a null owner, and E.7 makes the same choice when it
     * empties a deleted account's rows.
     *
     * This is what the rebuild caught first: the entry was written only inside
     * the `userId != null` branch that `player_stats` needs, so every guest
     * round was missing and the two paths disagreed.
     */
    const ids = await joinGame({ userId: null, guestName: 'Élise' });

    await recordSubmission(store.db, graded(ids));

    const rows = await entries();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBeNull();
  });

  it('keeps solo and multiplayer apart', async () => {
    // The track: "a solo game against a self-chosen topic is ranked separately
    // from multiplayer, or not at all. The two are not comparable."
    await addUser('ada');
    const solo = await joinGame({ userId: 'ada', mode: 'solo' });
    const room = await joinGame({ userId: 'ada', mode: 'multiplayer' });

    await recordSubmission(store.db, graded(solo));
    await recordSubmission(store.db, graded(room, { at: new Date(AT.getTime() + 1000) }));

    const rows = await entries();
    expect(rows.map((row) => row.mode)).toEqual(['solo', 'multiplayer']);
  });

  it('keeps the first score when a grading is retried', async () => {
    // `recordSubmission` refuses a second grading — `where submitted_at is
    // null` — so this asserts the entry cannot be rewritten either, even by a
    // caller that reaches past it.
    await addUser('ada');
    const ids = await joinGame({ userId: 'ada' });
    await recordSubmission(store.db, graded(ids));

    const again = await recordEligibleScore(store.db, {
      participantId: ids.participantId,
      userId: 'ada',
      mode: 'solo',
      score: 9999,
      finishedAt: new Date(AT.getTime() + 60_000),
    });

    expect(again).toBe(false);
    expect((await entries())[0]?.score).toBe(450);
  });

  it('loses the owner and keeps the round when an account is deleted', async () => {
    /*
     * E.7's shape: deleting an account leaves the rounds it played coherent.
     *
     * Through `deleteAccount` and **not** a raw `delete from "user"`, which is
     * the correction this case needed. That statement aborts by design —
     * `participant_account_or_guest` fires on a solo round whose `user_id`
     * became null and which never had a `guest_name` — and E.7 asserts the abort
     * rather than working around it. The first draft of this test used the raw
     * delete and failed for that reason, which is the register earning itself.
     */
    await addUser('ada');
    const ids = await joinGame({ userId: 'ada' });
    await recordSubmission(store.db, graded(ids));

    await deleteAccount(store.db, 'ada', 'a deleted player');

    const rows = await entries();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBeNull();
    expect(rows[0]?.score).toBe(450);
  });

  it('takes its entries with the game when the game goes', async () => {
    await addUser('ada');
    const ids = await joinGame({ userId: 'ada' });
    await recordSubmission(store.db, graded(ids));

    await store.db.delete(game).where(eq(game.id, ids.gameId));

    expect(await entries()).toEqual([]);
  });
});

describe.skipIf(url === null)('G.2 — the two paths agree', () => {
  let store: TestDatabase;

  beforeAll(async () => {
    store = await openTestDatabase(url as string);
  });

  beforeEach(async () => {
    await store.truncate();
  });

  afterAll(async () => {
    await store.close();
  });

  it('rebuilds to exactly what the write path produced', async () => {
    /*
     * The assertion this table was allowed to exist on.
     *
     * A mixed field — two accounts and a guest, solo and multiplayer, one round
     * left unfinished — is played through `recordSubmission`, and then the whole
     * table is derived again from the `participant` rows. Identical, or the fast
     * path is not to be trusted with a ranking.
     */
    for (const id of ['ada', 'bob']) {
      await store.db
        .insert(user)
        .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
    }

    const played: { gameId: string; participantId: string }[] = [];
    const owners: (string | null)[] = ['ada', 'bob', null, 'ada', 'bob'];
    const modes: ('solo' | 'multiplayer')[] = [
      'solo',
      'multiplayer',
      'multiplayer',
      'solo',
      'multiplayer',
    ];

    for (let index = 0; index < owners.length; index += 1) {
      const [row] = await store.db
        .insert(game)
        .values({
          mode: modes[index] as 'solo' | 'multiplayer',
          topic: 'Chat',
          sourceUrl: 'https://fr.wikipedia.org/wiki/Chat',
          paragraphs: ['un paragraphe'],
          totalFakes: 3,
          timeLimit: 300,
        })
        .returning({ id: game.id });
      const owner = owners[index] ?? null;
      const [player] = await store.db
        .insert(participant)
        .values({
          gameId: (row as { id: string }).id,
          ...(owner === null ? { guestName: 'a guest' } : { userId: owner }),
          colour: '#1f574d',
        })
        .returning({ id: participant.id });
      played.push({
        gameId: (row as { id: string }).id,
        participantId: (player as { id: string }).id,
      });
    }

    // Four graded, one left open — the one that must appear nowhere.
    for (let index = 0; index < 4; index += 1) {
      const ids = played[index] as { gameId: string; participantId: string };
      await recordSubmission(store.db, {
        gameId: ids.gameId,
        participantId: ids.participantId,
        marked: [1],
        score: 100 * (index + 1),
        truePositives: index,
        falsePositives: 0,
        hintsUsed: 0,
        hintPenalty: 0,
        scoreStolen: 0,
        timeBonus: 0,
        perfect: false,
        at: new Date(AT.getTime() + index * 60_000),
      });
    }

    const written = await selectEligibleScores(store.db);
    expect(written).toHaveLength(4);

    const count = await rebuildLeaderboard(store.db);
    const rebuilt = await selectEligibleScores(store.db);

    expect(count).toBe(4);
    expect(rebuilt).toEqual(written);
  });

  it('rebuilds an empty table from no rounds', async () => {
    // The degenerate case, because a rebuild that deleted and then failed to
    // insert would pass every assertion above on a database with rows in it.
    expect(await rebuildLeaderboard(store.db)).toBe(0);
    expect(await selectEligibleScores(store.db)).toEqual([]);
  });
});
