// What the shop shows — step H.7, against a real Postgres.
//
// The read path is where three independent facts become one row per item: what
// is in the catalogue, what the ledger says was bought, and what `profile` says
// is worn. The cases below are mostly about the combinations — a row that is
// owned and worn, owned and not, and neither owned nor affordable — because that
// is what decides which button a player is offered.
import {
  profile,
  purchaseCosmetic,
  recordMovement,
  setWornCosmetic,
  user,
} from '@wikifake/db';
import { COSMETIC_CATALOGUE, COSMETIC_IDS } from '@wikifake/domain';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { readShop } from './stock.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();
const FRAME = 'FRAME_DOUBLE';
const MARKER = 'MARKER_AMBER';

describe.skipIf(url === null)('H.7 — the shop a player is shown', () => {
  let store: TestDatabase;

  beforeAll(async () => {
    store = await openWebTestDatabase();
  });

  beforeEach(async () => {
    await store.truncate();
  });

  afterAll(async () => {
    await store.close();
  });

  async function addPlayer(id: string, coins = 0): Promise<void> {
    await store.db
      .insert(user)
      .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
    await store.db
      .insert(profile)
      .values({ userId: id, displayName: id, displayNameKey: id });

    if (coins > 0) {
      await recordMovement(store.db, {
        userId: id,
        amount: coins,
        source: 'adjustment',
        idempotencyKey: 'seed',
      });
    }
  }

  const shop = (userId: string) => readShop({ db: store.db }, userId);

  it('lists the whole catalogue, in slot order', async () => {
    // The catalogue is the stock: there is no table of what is for sale and no
    // `available` flag, so nothing can be in one and not the other.
    await addPlayer('ada');

    const view = await shop('ada');

    expect(view.items).toHaveLength(COSMETIC_IDS.length);
    expect(view.items.map((item) => item.slot)).toEqual([
      'marker',
      'marker',
      'marker',
      'marker',
      'markStyle',
      'markStyle',
      'markStyle',
      'frame',
      'frame',
      'frame',
    ]);
  });

  it('prices every row from the catalogue', async () => {
    await addPlayer('ada');

    for (const item of (await shop('ada')).items) {
      expect(item.price).toBe(COSMETIC_CATALOGUE[item.id].price);
    }
  });

  it('starts with nothing owned, nothing worn and no coins', async () => {
    await addPlayer('ada');

    const view = await shop('ada');

    expect(view.balance).toBe(0);
    expect(view.outfit).toEqual({ marker: null, markStyle: null, frame: null });
    expect(view.items.every((item) => !item.owned && !item.worn)).toBe(true);
    // And nothing is affordable, which is what the screen turns into a sentence
    // rather than a disabled button.
    expect(view.items.every((item) => !item.affordable)).toBe(true);
  });

  it('marks what the ledger says was bought', async () => {
    await addPlayer('ada', 1000);
    await purchaseCosmetic(store.db, {
      userId: 'ada',
      cosmeticId: FRAME,
      price: COSMETIC_CATALOGUE[FRAME].price,
    });

    const view = await shop('ada');
    const frame = view.items.find((item) => item.id === FRAME);

    expect(frame?.owned).toBe(true);
    expect(frame?.worn).toBe(false);
    expect(view.items.filter((item) => item.owned)).toHaveLength(1);
  });

  it('marks the one being worn, in its own slot only', async () => {
    await addPlayer('ada', 1000);
    await purchaseCosmetic(store.db, {
      userId: 'ada',
      cosmeticId: MARKER,
      price: COSMETIC_CATALOGUE[MARKER].price,
    });
    await setWornCosmetic(store.db, 'ada', 'marker', MARKER);

    const view = await shop('ada');

    expect(view.outfit.marker).toBe(MARKER);
    expect(view.items.filter((item) => item.worn).map((item) => item.id)).toEqual([
      MARKER,
    ]);
  });

  it('calls something owned affordable, whatever the balance', async () => {
    // "You cannot afford something you already have" is a sentence no screen
    // should be able to produce. The player spent their coins on it.
    await addPlayer('ada', COSMETIC_CATALOGUE[FRAME].price);
    await purchaseCosmetic(store.db, {
      userId: 'ada',
      cosmeticId: FRAME,
      price: COSMETIC_CATALOGUE[FRAME].price,
    });

    const view = await shop('ada');

    expect(view.balance).toBe(0);
    expect(view.items.find((item) => item.id === FRAME)?.affordable).toBe(true);
    expect(view.items.find((item) => item.id === MARKER)?.affordable).toBe(false);
  });

  it('reads a worn value that has since been retired as nothing worn', async () => {
    // `outfitFrom`'s rule reaching the shop: a retirement must not be an outage
    // on the screen of everybody who was wearing one.
    await addPlayer('ada');
    await setWornCosmetic(store.db, 'ada', 'frame', 'FRAME_GILDED');

    const view = await shop('ada');

    expect(view.outfit.frame).toBeNull();
    expect(view.items.some((item) => item.worn)).toBe(false);
  });

  it('shows a player with no profile row a shop rather than an error', async () => {
    // Buying writes only to the ledger, so an account with no pseudonym has a
    // balance and a catalogue. The page redirects it — a decision made there.
    await store.db.insert(user).values({
      id: 'bob',
      name: 'bob',
      email: 'bob@example.test',
      emailVerified: false,
    });

    const view = await shop('bob');

    expect(view.outfit).toEqual({ marker: null, markStyle: null, frame: null });
    expect(view.items).toHaveLength(COSMETIC_IDS.length);
  });

  it('does not read one player’s purchases as another’s', async () => {
    await addPlayer('ada', 1000);
    await addPlayer('bob', 1000);
    await purchaseCosmetic(store.db, {
      userId: 'ada',
      cosmeticId: FRAME,
      price: COSMETIC_CATALOGUE[FRAME].price,
    });

    expect((await shop('bob')).items.some((item) => item.owned)).toBe(false);
  });
});
