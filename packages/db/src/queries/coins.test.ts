// The coin ledger — step H.1, against a real Postgres.
//
// Two properties, and the track's exit gate names both: **the same key credits
// once**, and **a balance read matches the sum of its movements**. The second is
// the one that needs a real database and real concurrency, because the way it
// breaks is two credits reading the same balance and writing the same
// `balance_after` — after which nothing is wrong with either row on its own.
//
// The races open **their own connections**. `openTestDatabase` uses `max: 1`, so
// two transactions on the shared handle are serialised by the pool and never
// contend — `08-toolchain-debt.md` records that, and F.6's suite learned it the
// hard way when a check-then-write passed every case with "concurrently" in its
// name.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { sql } from 'drizzle-orm';

import { movementsOf, recordMovement, sumBalance } from './coins.js';
import { recordSubmission } from './session.js';
import { game, participant } from '../schema/game.js';
import { connect } from '../client.js';
import { coinMovement } from '../schema/coins.js';
import { user } from '../schema/auth.js';
import { openTestDatabase, rejectionCode, testDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '../testing/database.js';

const url = testDatabaseUrl();

describe.skipIf(url === null)('H.1 — every coin is a row', () => {
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

  const credit = (
    userId: string,
    amount: number,
    key: string,
    source: 'quest_reward' | 'round_end' = 'quest_reward',
  ) => recordMovement(store.db, { userId, amount, source, idempotencyKey: key });

  it('records a credit, with the balance it left behind', async () => {
    await addUser('ada');

    const outcome = await credit('ada', 20, 'quest:DAILY_FINISH_ROUNDS:20706');

    expect(outcome?.fresh).toBe(true);
    expect(outcome?.movement.amount).toBe(20);
    expect(outcome?.movement.balanceAfter).toBe(20);
    expect(await sumBalance(store.db, 'ada')).toBe(20);
  });

  it('adds up, and keeps `balance_after` in step', async () => {
    await addUser('ada');
    await credit('ada', 20, 'a');
    await credit('ada', 25, 'b');
    await recordMovement(store.db, {
      userId: 'ada',
      amount: -10,
      source: 'hint_purchase',
      idempotencyKey: 'c',
    });

    expect(await sumBalance(store.db, 'ada')).toBe(35);
    const ledger = await movementsOf(store.db, 'ada');
    expect(ledger[0]?.balanceAfter).toBe(35);
    expect(ledger.map((row) => row.amount)).toEqual([-10, 25, 20]);
  });

  it('credits once for one key, and says it was not fresh', async () => {
    // The exit gate: "the same credit applied twice with one idempotency key
    // credits once".
    await addUser('ada');
    const first = await credit('ada', 20, 'quest:one');

    const again = await credit('ada', 20, 'quest:one');

    expect(again?.fresh).toBe(false);
    expect(again?.movement.id).toBe(first?.movement.id);
    expect(await sumBalance(store.db, 'ada')).toBe(20);
  });

  it('hands a retry the amount it bought the first time, not the one it asked for', async () => {
    /*
     * A retry with the same key and a *different* amount is a bug in the caller,
     * and the honest answer is what happened rather than what was asked for. It
     * must not be the new amount, and it must not be an error either: the
     * request has already succeeded once.
     */
    await addUser('ada');
    await credit('ada', 20, 'quest:one');

    const again = await credit('ada', 9999, 'quest:one');

    expect(again?.movement.amount).toBe(20);
    expect(await sumBalance(store.db, 'ada')).toBe(20);
  });

  it('keeps one player’s keys out of another’s way', async () => {
    // The constraint is `(user_id, idempotency_key)` and not the key alone: two
    // players claiming the same quest on the same day build the same key, and
    // the first to arrive must not deny the second.
    await addUser('ada');
    await addUser('bob');

    await credit('ada', 20, 'quest:DAILY_FINISH_ROUNDS:20706');
    const bob = await credit('bob', 20, 'quest:DAILY_FINISH_ROUNDS:20706');

    expect(bob?.fresh).toBe(true);
    expect(await sumBalance(store.db, 'bob')).toBe(20);
  });

  it('refuses a movement of nothing', async () => {
    await addUser('ada');

    const code = await rejectionCode(
      store.db.insert(coinMovement).values({
        userId: 'ada',
        amount: 0,
        source: 'adjustment',
        idempotencyKey: 'zero',
        balanceAfter: 0,
      }),
    );

    // 23514 — the check. A movement of nothing is a row saying something
    // happened when nothing did.
    expect(code).toBe('23514');
  });

  it('lets a balance go negative, because refusing is not this layer’s job', async () => {
    /*
     * Deliberate, and stated in the schema. Whether a player may overdraw is a
     * rule about *spending*, and it belongs to H.4 where refusing is a sentence
     * a player can act on. A constraint here would make an overdraft a database
     * error on a path that cannot explain itself — and would make a correction
     * impossible to record.
     */
    await addUser('ada');

    const spent = await recordMovement(store.db, {
      userId: 'ada',
      amount: -50,
      source: 'adjustment',
      idempotencyKey: 'correction',
    });

    expect(spent?.movement.balanceAfter).toBe(-50);
    expect(await sumBalance(store.db, 'ada')).toBe(-50);
  });

  it('says nothing happened for a player who does not exist', async () => {
    expect(await credit('nobody', 20, 'a')).toBeNull();
  });

  it('gives a player with no movements a balance of zero', async () => {
    await addUser('ada');

    // Zero and not null: nobody has ever earned a coin is a balance.
    expect(await sumBalance(store.db, 'ada')).toBe(0);
  });

  it('takes the ledger with the account', async () => {
    await addUser('ada');
    await credit('ada', 20, 'a');

    await store.db.delete(user);

    expect(await movementsOf(store.db, 'ada')).toEqual([]);
  });
});

describe.skipIf(url === null)('H.1 — the ledger under contention', () => {
  let store: TestDatabase;

  beforeAll(async () => {
    store = await openTestDatabase(url as string);
  });

  beforeEach(async () => {
    await store.truncate();
    await store.db.insert(user).values({
      id: 'ada',
      name: 'ada',
      email: 'ada@example.test',
      emailVerified: false,
    });
  });

  afterAll(async () => {
    await store.close();
  });

  it('keeps the sum and the last `balance_after` in agreement', async () => {
    /*
     * The property `balance_after` is only safe because of, and the reason
     * `recordMovement` locks the player first.
     *
     * Ten credits with ten different keys, over four real connections. Without
     * the lock, two of them read the same balance and write the same
     * `balance_after` — and **nothing is wrong with either row on its own**,
     * which is why this cannot be caught by reading one.
     */
    const pools = Array.from({ length: 4 }, () =>
      connect({ url: url as string, max: 1 }),
    );
    try {
      await Promise.all(
        Array.from({ length: 10 }, (_, index) =>
          (pools[index % pools.length] as (typeof pools)[number]).db.transaction((tx) =>
            recordMovement(tx, {
              userId: 'ada',
              amount: 10,
              source: 'round_end',
              idempotencyKey: `round:${String(index)}`,
            }),
          ),
        ),
      );

      const ledger = await movementsOf(store.db, 'ada', 100);
      expect(ledger).toHaveLength(10);
      expect(await sumBalance(store.db, 'ada')).toBe(100);

      // Every `balance_after` distinct and ending at the sum: a repeat means two
      // movements read the same balance.
      const balances = ledger.map((row) => row.balanceAfter).sort((a, b) => a - b);
      expect(balances).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    } finally {
      await Promise.all(pools.map((pool) => pool.close()));
    }
  });

  it('credits once when the same key arrives from four connections at once', async () => {
    // The retry storm: a client that fired the same request four times. One
    // movement, and three callers told what it bought.
    const pools = Array.from({ length: 4 }, () =>
      connect({ url: url as string, max: 1 }),
    );
    try {
      const outcomes = await Promise.all(
        pools.map((pool) =>
          pool.db.transaction((tx) =>
            recordMovement(tx, {
              userId: 'ada',
              amount: 20,
              source: 'quest_reward',
              idempotencyKey: 'quest:one',
            }),
          ),
        ),
      );

      expect(outcomes.filter((outcome) => outcome?.fresh === true)).toHaveLength(1);
      expect(await sumBalance(store.db, 'ada')).toBe(20);
      expect(await movementsOf(store.db, 'ada')).toHaveLength(1);
    } finally {
      await Promise.all(pools.map((pool) => pool.close()));
    }
  });
});

describe.skipIf(url === null)('H.3 — a round pays into the ledger', () => {
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

  const AT = new Date('2026-09-10T12:00:00.000Z');

  const addUser = async (id: string): Promise<void> => {
    await store.db
      .insert(user)
      .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
  };

  /** A game with one participant, ungraded. */
  const joinGame = async (
    owner: string | null,
  ): Promise<{ gameId: string; participantId: string }> => {
    const [row] = await store.db
      .insert(game)
      .values({
        mode: 'solo',
        topic: 'Chat',
        sourceUrl: 'https://fr.wikipedia.org/wiki/Chat',
        paragraphs: ['un paragraphe'],
        totalFakes: 3,
        timeLimit: 300,
      })
      .returning({ id: game.id });
    const [player] = await store.db
      .insert(participant)
      .values({
        gameId: (row as { id: string }).id,
        ...(owner === null ? { guestName: 'a guest' } : { userId: owner }),
        colour: '#1f574d',
      })
      .returning({ id: participant.id });

    return {
      gameId: (row as { id: string }).id,
      participantId: (player as { id: string }).id,
    };
  };

  const grade = (
    ids: { gameId: string; participantId: string },
    coins?: number,
  ): Promise<boolean> =>
    recordSubmission(store.db, {
      gameId: ids.gameId,
      participantId: ids.participantId,
      marked: [1],
      score: 400,
      truePositives: 3,
      falsePositives: 0,
      hintsUsed: 0,
      hintPenalty: 0,
      scoreStolen: 0,
      timeBonus: 0,
      perfect: true,
      at: AT,
      ...(coins === undefined ? {} : { coins }),
    });

  it('credits the round in the transaction that graded it', async () => {
    await addUser('ada');
    const ids = await joinGame('ada');

    expect(await grade(ids, 5)).toBe(true);

    const ledger = await movementsOf(store.db, 'ada');
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      amount: 5,
      source: 'round_end',
      reference: ids.gameId,
      balanceAfter: 5,
    });
  });

  it('pays a replayed grading once', async () => {
    // `recordSubmission` refuses a second grading — `where submitted_at is
    // null` — and the key is the participation, so even a caller reaching past
    // it cannot pay twice.
    await addUser('ada');
    const ids = await joinGame('ada');
    await grade(ids, 5);

    await grade(ids, 5);

    expect(await sumBalance(store.db, 'ada')).toBe(5);
  });

  it('pays a guest nothing', async () => {
    /*
     * Coins are an account feature, like quests, and the reason is the same one
     * F.7 gave: `coin_movement` cascades on `user_id`, and the anonymous plugin
     * deletes that row the moment a guest signs up. Crediting a guest would be
     * crediting coins that disappear.
     *
     * Their *round* still follows them — E.6 moves the participant rows — so
     * what they lose is the trickle, not the history.
     */
    const ids = await joinGame(null);

    expect(await grade(ids, 5)).toBe(true);

    const [row] = await store.db
      .select({ count: sql<number>`count(*)::int` })
      .from(coinMovement);
    expect(row?.count).toBe(0);
  });

  it('credits nothing when the round is worth nothing', async () => {
    // Zero and absent both credit nothing, because `amount <> 0` refuses a
    // movement of nothing and a round worth nothing is not a movement.
    await addUser('ada');

    const zero = await joinGame('ada');
    await grade(zero, 0);
    const absent = await joinGame('ada');
    await grade(absent);

    expect(await movementsOf(store.db, 'ada')).toEqual([]);
    expect(await sumBalance(store.db, 'ada')).toBe(0);
  });

  it('leaves no coins behind when its transaction rolls back', async () => {
    /*
     * H.1 promised that `recordMovement` runs inside the caller's transaction,
     * and this is that promise tested rather than asserted.
     *
     * **The first version of this case was named for a rollback and only
     * asserted the happy path** — a test claiming more than it does, which is
     * worse than no test. Forcing `recordSubmission` to fail *after* the credit
     * needs a failure planted in a statement it makes later, and there is no
     * honest way to plant one from out here. So the property is tested where it
     * can be: a transaction that credits and then throws must leave nothing.
     */
    await addUser('ada');

    await expect(
      store.db.transaction(async (tx) => {
        await recordMovement(tx, {
          userId: 'ada',
          amount: 5,
          source: 'round_end',
          idempotencyKey: 'round:rolled-back',
        });
        // The balance is real inside the transaction, which is what makes the
        // assertion afterwards mean something.
        expect(await sumBalance(tx, 'ada')).toBe(5);
        throw new Error('the round did not finish');
      }),
    ).rejects.toThrow('the round did not finish');

    expect(await sumBalance(store.db, 'ada')).toBe(0);
    expect(await movementsOf(store.db, 'ada')).toEqual([]);
  });
});
