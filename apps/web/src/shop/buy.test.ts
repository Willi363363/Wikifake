// Buying a cosmetic — step H.7, through the handler against a real Postgres.
//
// What the cases are about is the three ways a purchase can end that are not
// success: already bought, not enough coins, and nothing by that name. The
// first is deliberately **not** a refusal — H.6's idempotency key is the
// cosmetic, so a second attempt spends nothing and a 4xx would make a
// double-click look like a failure.
import {
  recordMovement,
  selectOwnedCosmetics,
  selectWorn,
  sumBalance,
} from '@wikifake/db';
import { COSMETIC_CATALOGUE } from '@wikifake/domain';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createAuth } from '../auth/auth.js';
import { handleBuyCosmetic } from './buy.js';
import { handleClaimPseudonym } from '../account/claim.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();
const BASE = 'http://localhost:3000';
const SECRET = 'a-fake-test-signing-secret-32-chars-min';

const FRAME = 'FRAME_DOUBLE';
const PRICE = COSMETIC_CATALOGUE[FRAME].price;

describe.skipIf(url === null)('H.7 — buying a cosmetic', () => {
  let store: TestDatabase;
  let instance: ReturnType<typeof createAuth>;

  beforeAll(async () => {
    store = await openWebTestDatabase();
    instance = createAuth({ db: store.db, secret: SECRET, baseURL: BASE });
  });

  beforeEach(async () => {
    await store.truncate();
  });

  afterAll(async () => {
    await store.close();
  });

  const context = () => ({ auth: instance, db: store.db });

  async function signUp(email: string): Promise<{ cookie: string; userId: string }> {
    const answer = await instance.handler(
      new Request(`${BASE}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Ada', email, password: 'a-password-of-length' }),
      }),
    );
    const body = (await answer.json()) as { user?: { id?: string } };
    const userId = body.user?.id;
    if (userId === undefined) throw new Error('no account');

    const cookie = (answer.headers.getSetCookie() ?? [])
      .map((raw) => raw.split(';')[0])
      .filter((pair): pair is string => pair !== undefined)
      .join('; ');
    return { cookie, userId };
  }

  /** An account with a pseudonym and a balance. */
  async function player(
    email: string,
    coins = 0,
  ): Promise<{ cookie: string; userId: string }> {
    const account = await signUp(email);
    await handleClaimPseudonym(
      context(),
      new Request(`${BASE}/api/account/pseudonym`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: account.cookie },
        body: JSON.stringify({ pseudonym: email.split('@')[0] }),
      }),
    );

    if (coins > 0) {
      await recordMovement(store.db, {
        userId: account.userId,
        amount: coins,
        source: 'adjustment',
        idempotencyKey: 'seed',
      });
    }

    return account;
  }

  const buy = (cookie: string, body: unknown): Promise<Response> =>
    handleBuyCosmetic(
      context(),
      new Request(`${BASE}/api/shop/buy`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify(body),
      }),
    );

  it('spends the catalogue price and hands back what is left', async () => {
    const ada = await player('ada@example.test', 500);

    const answer = await buy(ada.cookie, { cosmeticId: FRAME });

    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({
      cosmeticId: FRAME,
      spent: PRICE,
      balance: 500 - PRICE,
      already: false,
    });
    expect(await selectOwnedCosmetics(store.db, ada.userId)).toEqual([FRAME]);
    expect(await sumBalance(store.db, ada.userId)).toBe(500 - PRICE);
  });

  it('takes no price from the request, whatever it sends', async () => {
    // The contract carries no price, and a body with one is simply ignored
    // rather than trusted: the catalogue is the price.
    const ada = await player('ada@example.test', 500);

    const answer = await buy(ada.cookie, { cosmeticId: FRAME, price: 1 });

    expect((await answer.json()).spent).toBe(PRICE);
    expect(await sumBalance(store.db, ada.userId)).toBe(500 - PRICE);
  });

  it('spends once when the same thing is bought twice', async () => {
    const ada = await player('ada@example.test', 1000);

    const first = await buy(ada.cookie, { cosmeticId: FRAME });
    const second = await buy(ada.cookie, { cosmeticId: FRAME });

    expect((await first.json()).already).toBe(false);
    // Answered, not refused: a double-click is not a failure.
    expect(second.status).toBe(200);
    const body = await second.json();
    expect(body.already).toBe(true);
    expect(body.spent).toBe(0);
    expect(body.balance).toBe(1000 - PRICE);
    expect(await sumBalance(store.db, ada.userId)).toBe(1000 - PRICE);
  });

  it('refuses a player who cannot afford it, and spends nothing', async () => {
    const ada = await player('ada@example.test', PRICE - 1);

    const answer = await buy(ada.cookie, { cosmeticId: FRAME });

    expect(answer.status).toBe(402);
    expect((await answer.json()).code).toBe('insufficient_coins');
    expect(await sumBalance(store.db, ada.userId)).toBe(PRICE - 1);
    expect(await selectOwnedCosmetics(store.db, ada.userId)).toEqual([]);
  });

  it('refuses a player with no coins at all', async () => {
    const ada = await player('ada@example.test');

    expect((await buy(ada.cookie, { cosmeticId: FRAME })).status).toBe(402);
  });

  it('says plainly that nothing by that name is for sale', async () => {
    // Unlike the wear path, which hides whether a cosmetic exists: a shop has a
    // public price list, so refusing to say what is in it would be secrecy
    // about nothing.
    const ada = await player('ada@example.test', 500);

    const answer = await buy(ada.cookie, { cosmeticId: 'FRAME_GILDED' });

    expect(answer.status).toBe(404);
    expect((await answer.json()).code).toBe('cosmetic_not_found');
    expect(await sumBalance(store.db, ada.userId)).toBe(500);
  });

  it('does not wear what it just bought', async () => {
    // One action, one effect. A purchase that also changed how the player looks
    // would make "what does undoing this undo" a question with two answers, the
    // moment H.8's refund seam is real.
    const ada = await player('ada@example.test', 500);

    await buy(ada.cookie, { cosmeticId: FRAME });

    expect(await selectWorn(store.db, ada.userId)).toEqual({
      marker: null,
      markStyle: null,
      frame: null,
    });
  });

  it('refuses a guest, who has no ledger to spend from', async () => {
    const guest = await instance.handler(
      new Request(`${BASE}/api/auth/sign-in/anonymous`, { method: 'POST' }),
    );
    const cookie = (guest.headers.getSetCookie() ?? [])
      .map((raw) => raw.split(';')[0])
      .filter((pair): pair is string => pair !== undefined)
      .join('; ');

    const answer = await buy(cookie, { cosmeticId: FRAME });

    expect(answer.status).toBe(404);
    expect((await answer.json()).code).toBe('session_not_found');
  });

  it('refuses nobody at all', async () => {
    expect((await buy('', { cosmeticId: FRAME })).status).toBe(404);
  });

  it('refuses a body with no identifier', async () => {
    const ada = await player('ada@example.test', 500);

    expect((await buy(ada.cookie, {})).status).toBe(400);
    expect((await buy(ada.cookie, { cosmeticId: '' })).status).toBe(400);
  });

  it('does not need a pseudonym: the ledger is on the account', async () => {
    // Unlike wearing, which writes to `profile`. Buying writes only to
    // `coin_movement`, so it works for an account that has not chosen a name —
    // and the page redirects such an account anyway, which is a different
    // decision made in a different place.
    const ada = await signUp('ada@example.test');
    await recordMovement(store.db, {
      userId: ada.userId,
      amount: 500,
      source: 'adjustment',
      idempotencyKey: 'seed',
    });

    expect((await buy(ada.cookie, { cosmeticId: FRAME })).status).toBe(200);
  });
});
