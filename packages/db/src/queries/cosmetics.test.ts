// Owning a cosmetic, and wearing one — step H.6, against a real Postgres.
//
// The decision this suite exists to hold: **ownership is derived from the
// ledger**, so there is no table to keep in step with it. What has to be true
// instead is that the derivation is correct, that it cannot be made to record a
// purchase twice, and that reading it is cheap — the third being the whole cost
// of the choice, so it is measured against `EXPLAIN` rather than assumed.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { sql } from 'drizzle-orm';

import {
  ownsCosmetic,
  purchaseCosmetic,
  selectOwnedCosmetics,
  selectWorn,
  setWornCosmetic,
} from './cosmetics.js';
import { recordMovement, sumBalance } from './coins.js';
import { coinMovement } from '../schema/coins.js';
import { profile } from '../schema/profile.js';
import { user } from '../schema/auth.js';
import { openTestDatabase, testDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '../testing/database.js';

const url = testDatabaseUrl();

const FRAME = 'FRAME_DOUBLE';
const MARKER = 'MARKER_CRIMSON';

describe.skipIf(url === null)('H.6 — ownership comes out of the ledger', () => {
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

  const addPlayer = async (id: string, withProfile = true): Promise<void> => {
    await store.db
      .insert(user)
      .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
    if (withProfile) {
      await store.db
        .insert(profile)
        .values({ userId: id, displayName: id, displayNameKey: id });
    }
  };

  const give = (userId: string, amount: number) =>
    recordMovement(store.db, {
      userId,
      amount,
      source: 'adjustment',
      idempotencyKey: `seed:${String(amount)}`,
    });

  it('owns what it bought, and nothing it did not', async () => {
    await addPlayer('ada');
    await give('ada', 500);

    await purchaseCosmetic(store.db, { userId: 'ada', cosmeticId: FRAME, price: 300 });

    expect(await ownsCosmetic(store.db, 'ada', FRAME)).toBe(true);
    expect(await ownsCosmetic(store.db, 'ada', MARKER)).toBe(false);
    expect(await selectOwnedCosmetics(store.db, 'ada')).toEqual([FRAME]);
    expect(await sumBalance(store.db, 'ada')).toBe(200);
  });

  it("does not read one player's purchases as another's", async () => {
    await addPlayer('ada');
    await addPlayer('bob');
    await give('ada', 500);
    await purchaseCosmetic(store.db, { userId: 'ada', cosmeticId: FRAME, price: 300 });

    expect(await ownsCosmetic(store.db, 'bob', FRAME)).toBe(false);
    expect(await selectOwnedCosmetics(store.db, 'bob')).toEqual([]);
  });

  it('charges once for the same cosmetic, however many times it is bought', async () => {
    // The idempotency key is the cosmetic, so owning it is something the ledger
    // cannot record twice. This is the double-click, and the unique index is
    // doing the job a `unique(user_id, cosmetic_id)` would have done on the
    // table this step chose not to create.
    await addPlayer('ada');
    await give('ada', 1000);

    const first = await purchaseCosmetic(store.db, {
      userId: 'ada',
      cosmeticId: FRAME,
      price: 300,
    });
    const second = await purchaseCosmetic(store.db, {
      userId: 'ada',
      cosmeticId: FRAME,
      price: 300,
    });

    expect(first?.fresh).toBe(true);
    expect(second?.fresh).toBe(false);
    expect(second?.movement.id).toBe(first?.movement.id);
    expect(await sumBalance(store.db, 'ada')).toBe(700);
    expect(await selectOwnedCosmetics(store.db, 'ada')).toEqual([FRAME]);
  });

  it('lets two players buy the same cosmetic', async () => {
    // The key is unique per player, not globally — H.1's decision, and this is
    // the case that would have gone wrong the other way round.
    await addPlayer('ada');
    await addPlayer('bob');
    await give('ada', 500);
    await give('bob', 500);

    const ada = await purchaseCosmetic(store.db, {
      userId: 'ada',
      cosmeticId: FRAME,
      price: 300,
    });
    const bob = await purchaseCosmetic(store.db, {
      userId: 'bob',
      cosmeticId: FRAME,
      price: 300,
    });

    expect(ada?.fresh).toBe(true);
    expect(bob?.fresh).toBe(true);
  });

  it('answers for a player who does not exist rather than inventing one', async () => {
    expect(
      await purchaseCosmetic(store.db, {
        userId: 'nobody',
        cosmeticId: FRAME,
        price: 300,
      }),
    ).toBeNull();
    expect(await ownsCosmetic(store.db, 'nobody', FRAME)).toBe(false);
  });

  it('expresses a grant as two rows, leaving the balance where it was', async () => {
    // The cost of having no ownership table, paid in full: a cosmetic given
    // away is an `adjustment` crediting the price and the purchase spending it.
    // Track I's admin panel needs no new mechanism, and the ledger explains
    // itself — which a row in an ownership table would not have.
    await addPlayer('ada');

    await recordMovement(store.db, {
      userId: 'ada',
      amount: 300,
      source: 'adjustment',
      reference: `grant:${FRAME}`,
      idempotencyKey: `grant:${FRAME}`,
    });
    await purchaseCosmetic(store.db, { userId: 'ada', cosmeticId: FRAME, price: 300 });

    expect(await ownsCosmetic(store.db, 'ada', FRAME)).toBe(true);
    expect(await sumBalance(store.db, 'ada')).toBe(0);
  });

  it('reads only cosmetic purchases, not every movement with a reference', async () => {
    // `reference` carries a quest's rule id too. A derivation that forgot the
    // source would hand a player every quest they have ever claimed as a
    // cosmetic they own.
    await addPlayer('ada');
    await recordMovement(store.db, {
      userId: 'ada',
      amount: 20,
      source: 'quest_reward',
      reference: 'DAILY_FINISH_ROUNDS',
      idempotencyKey: 'quest:DAILY_FINISH_ROUNDS:20706',
    });

    expect(await selectOwnedCosmetics(store.db, 'ada')).toEqual([]);
    expect(await ownsCosmetic(store.db, 'ada', 'DAILY_FINISH_ROUNDS')).toBe(false);
  });
});

describe.skipIf(url === null)('H.6 — what the ownership read costs', () => {
  let store: TestDatabase;

  beforeAll(async () => {
    store = await openTestDatabase(url as string);
    await store.truncate();

    await store.db.insert(user).values({
      id: 'ada',
      name: 'ada',
      email: 'ada@example.test',
      emailVerified: false,
    });

    // A ledger the shape a real one has: thousands of round credits and a
    // handful of purchases. That ratio is the reason the index is partial, so
    // the fixture has to have it or the measurement means nothing.
    await store.db.insert(coinMovement).values(
      Array.from({ length: 3000 }, (_, at) => ({
        userId: 'ada',
        amount: 2,
        source: 'round_end' as const,
        reference: `round:${String(at)}`,
        idempotencyKey: `round:${String(at)}`,
        balanceAfter: 2 * (at + 1),
      })),
    );
    await store.db.insert(coinMovement).values(
      ['FRAME_DOUBLE', 'MARKER_AMBER', 'MARK_STYLE_BRACKET'].map((id, at) => ({
        userId: 'ada',
        amount: -200,
        source: 'cosmetic_purchase' as const,
        reference: id,
        idempotencyKey: `cosmetic:${id}`,
        balanceAfter: 6000 - 200 * (at + 1),
      })),
    );
    await store.db.execute(sql`analyze coin_movement`);
  }, 60_000);

  afterAll(async () => {
    await store.close();
  });

  it('answers "do you own this" from the partial index, not from the ledger', async () => {
    // The whole cost of deriving ownership instead of storing it. A sequential
    // scan here would be three thousand rows read to answer a question about
    // three, on a page that draws the shop.
    const plan = await store.db.execute(
      sql`explain (analyze, buffers) select 1 from coin_movement
          where user_id = 'ada' and source = 'cosmetic_purchase'
            and reference = 'MARKER_AMBER' limit 1`,
    );
    // Every row of the plan, not the first: the first is the `Limit` node, and
    // reading only that is how a test asserts nothing while looking thorough.
    const text = plan.map((row) => Object.values(row).join(' ')).join('\n');

    expect(text).toContain('coin_movement_owned_idx');
    expect(text).not.toMatch(/Seq Scan on coin_movement/);
  });

  it('lists everything owned without reading the round credits', async () => {
    const plan = await store.db.execute(
      sql`explain (analyze, buffers) select reference from coin_movement
          where user_id = 'ada' and source = 'cosmetic_purchase' order by seq`,
    );
    const text = plan.map((row) => Object.values(row).join(' ')).join('\n');

    // The index carries `(user_id, reference)` and the predicate, so the three
    // purchase rows are found without touching the three thousand credits.
    expect(text).toContain('coin_movement_owned_idx');
    expect(text).not.toMatch(/Seq Scan on coin_movement/);
  });

  it('agrees with the list it is derived from', async () => {
    // Two paths to the same fact, held to each other: the count-style lookup
    // and the list. A partial index that quietly excluded a row would make one
    // of these lie, and only comparing them would show it.
    const owned = await selectOwnedCosmetics(store.db, 'ada');
    expect([...owned].sort()).toEqual([
      'FRAME_DOUBLE',
      'MARKER_AMBER',
      'MARK_STYLE_BRACKET',
    ]);

    for (const id of owned) {
      expect(await ownsCosmetic(store.db, 'ada', id)).toBe(true);
    }
  });
});

describe.skipIf(url === null)('H.6 — wearing one', () => {
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

  const addPlayer = async (id: string, withProfile = true): Promise<void> => {
    await store.db
      .insert(user)
      .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
    if (withProfile) {
      await store.db
        .insert(profile)
        .values({ userId: id, displayName: id, displayNameKey: id });
    }
  };

  it("starts wearing nothing, which is the design system's own choice", async () => {
    await addPlayer('ada');

    expect(await selectWorn(store.db, 'ada')).toEqual({
      marker: null,
      markStyle: null,
      frame: null,
    });
  });

  it('writes one slot without disturbing the others', async () => {
    await addPlayer('ada');

    expect(await setWornCosmetic(store.db, 'ada', 'frame', FRAME)).toBe(true);
    expect(await setWornCosmetic(store.db, 'ada', 'marker', MARKER)).toBe(true);

    expect(await selectWorn(store.db, 'ada')).toEqual({
      marker: MARKER,
      markStyle: null,
      frame: FRAME,
    });
  });

  it('replaces within a slot rather than accumulating', async () => {
    await addPlayer('ada');
    await setWornCosmetic(store.db, 'ada', 'marker', MARKER);
    await setWornCosmetic(store.db, 'ada', 'marker', 'MARKER_AMBER');

    expect((await selectWorn(store.db, 'ada'))?.marker).toBe('MARKER_AMBER');
  });

  it('clears a slot back to the default', async () => {
    await addPlayer('ada');
    await setWornCosmetic(store.db, 'ada', 'frame', FRAME);

    expect(await setWornCosmetic(store.db, 'ada', 'frame', null)).toBe(true);
    expect((await selectWorn(store.db, 'ada'))?.frame).toBeNull();
  });

  it('refuses a player with no profile row rather than creating one', async () => {
    // `setChosenRegion`'s reason: a row created here would have no pseudonym,
    // which is the state E.3.2's gate exists to end.
    await addPlayer('ada', false);

    expect(await setWornCosmetic(store.db, 'ada', 'frame', FRAME)).toBe(false);
    expect(await selectWorn(store.db, 'ada')).toBeNull();
    const rows = await store.db.select({ userId: profile.userId }).from(profile);
    expect(rows).toEqual([]);
  });

  it('survives an account being deleted, since the cosmetic went with it', async () => {
    // The ledger cascades from `user`, and so does the profile. What must not
    // happen is a worn value outliving the purchase that justified it.
    await addPlayer('ada');
    await store.db.insert(coinMovement).values({
      userId: 'ada',
      amount: -300,
      source: 'cosmetic_purchase',
      reference: FRAME,
      idempotencyKey: `cosmetic:${FRAME}`,
      balanceAfter: 0,
    });
    await setWornCosmetic(store.db, 'ada', 'frame', FRAME);

    await store.db.delete(user).where(sql`id = 'ada'`);

    expect(await selectOwnedCosmetics(store.db, 'ada')).toEqual([]);
    expect(await selectWorn(store.db, 'ada')).toBeNull();
  });
});
