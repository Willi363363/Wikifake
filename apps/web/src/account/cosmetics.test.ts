// Wearing a cosmetic — step H.6, through the handler.
//
// The place the two halves of H.6 meet: the rules say what may be worn and the
// **ledger** says what is owned. So these cases buy through
// `purchaseCosmetic` rather than inserting an ownership row, because there is no
// ownership row — that is the decision this step turned on.
//
// The session is real rather than mocked: `createAuth` over the same test
// database, the shape `guests.test.ts` established.
import { purchaseCosmetic, recordMovement, selectWorn } from '@wikifake/db';
import { COSMETIC_CATALOGUE } from '@wikifake/domain';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createAuth } from '../auth/auth.js';
import { handleClaimPseudonym } from './claim.js';
import { handleWearCosmetic } from './cosmetics.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();
const BASE = 'http://localhost:3000';
const SECRET = 'a-fake-test-signing-secret-32-chars-min';

const FRAME = 'FRAME_DOUBLE';
const MARKER = 'MARKER_VIOLET';

describe.skipIf(url === null)('H.6 — what a player is wearing', () => {
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

  /** An account with a pseudonym, coins, and whatever it has bought. */
  async function player(
    email: string,
    buy: readonly string[] = [],
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

    if (buy.length > 0) {
      await recordMovement(store.db, {
        userId: account.userId,
        amount: 5000,
        source: 'adjustment',
        idempotencyKey: 'seed',
      });
      for (const id of buy) {
        await purchaseCosmetic(store.db, {
          userId: account.userId,
          cosmeticId: id,
          price: COSMETIC_CATALOGUE[id as keyof typeof COSMETIC_CATALOGUE].price,
        });
      }
    }

    return account;
  }

  const wear = (cookie: string, body: unknown): Promise<Response> =>
    handleWearCosmetic(
      context(),
      new Request(`${BASE}/api/account/cosmetics`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify(body),
      }),
    );

  it('wears something the ledger says was bought', async () => {
    const ada = await player('ada@example.test', [FRAME]);

    const answer = await wear(ada.cookie, { cosmeticId: FRAME });

    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({ marker: null, markStyle: null, frame: FRAME });
    expect(await selectWorn(store.db, ada.userId)).toEqual({
      marker: null,
      markStyle: null,
      frame: FRAME,
    });
  });

  it('puts it in the slot the catalogue says, not one the request chose', async () => {
    // The request carries no slot, which is the contract's decision: a request
    // with both could disagree with itself.
    const ada = await player('ada@example.test', [MARKER, FRAME]);

    await wear(ada.cookie, { cosmeticId: MARKER });
    await wear(ada.cookie, { cosmeticId: FRAME });

    expect(await selectWorn(store.db, ada.userId)).toEqual({
      marker: MARKER,
      markStyle: null,
      frame: FRAME,
    });
  });

  it('refuses one the player has not bought', async () => {
    const ada = await player('ada@example.test');

    const answer = await wear(ada.cookie, { cosmeticId: FRAME });

    expect(answer.status).toBe(403);
    expect((await answer.json()).code).toBe('cosmetic_not_owned');
    expect((await selectWorn(store.db, ada.userId))?.frame).toBeNull();
  });

  it('refuses an identifier nobody has ever sold, with the same code', async () => {
    // One refusal for unknown and unowned both: telling them apart would answer
    // "does this cosmetic exist" to somebody who has not got it, which
    // enumerates the catalogue — including what a launch has not announced.
    const ada = await player('ada@example.test', [FRAME]);

    const answer = await wear(ada.cookie, { cosmeticId: 'FRAME_GILDED' });

    expect(answer.status).toBe(403);
    expect((await answer.json()).code).toBe('cosmetic_not_owned');
  });

  it('does not let one player wear what another bought', async () => {
    await player('bob@example.test', [FRAME]);
    const ada = await player('ada@example.test');

    const answer = await wear(ada.cookie, { cosmeticId: FRAME });

    expect(answer.status).toBe(403);
  });

  it('takes one off with a slot and no identifier', async () => {
    // The only shape that can say it: H.5 refused a free catalogue entry, so
    // there is no identifier meaning "the design system's own choice".
    const ada = await player('ada@example.test', [FRAME]);
    await wear(ada.cookie, { cosmeticId: FRAME });

    const answer = await wear(ada.cookie, { slot: 'frame' });

    expect(answer.status).toBe(200);
    expect((await answer.json()).frame).toBeNull();
  });

  it('leaves the other slots alone when one is taken off', async () => {
    const ada = await player('ada@example.test', [MARKER, FRAME]);
    await wear(ada.cookie, { cosmeticId: MARKER });
    await wear(ada.cookie, { cosmeticId: FRAME });

    await wear(ada.cookie, { slot: 'frame' });

    expect(await selectWorn(store.db, ada.userId)).toEqual({
      marker: MARKER,
      markStyle: null,
      frame: null,
    });
  });

  it('answers with the whole outfit, not the slot that changed', async () => {
    // A screen patching one slot from its own request is a screen that can
    // drift. The answer is what the next page load would show.
    const ada = await player('ada@example.test', [MARKER, FRAME]);
    await wear(ada.cookie, { cosmeticId: FRAME });

    const answer = await wear(ada.cookie, { cosmeticId: MARKER });

    expect(await answer.json()).toEqual({
      marker: MARKER,
      markStyle: null,
      frame: FRAME,
    });
  });

  it('refuses a guest, who has no ledger to own anything in', async () => {
    const guest = await instance.handler(
      new Request(`${BASE}/api/auth/sign-in/anonymous`, { method: 'POST' }),
    );
    const cookie = (guest.headers.getSetCookie() ?? [])
      .map((raw) => raw.split(';')[0])
      .filter((pair): pair is string => pair !== undefined)
      .join('; ');

    const answer = await wear(cookie, { slot: 'frame' });

    expect(answer.status).toBe(404);
    expect((await answer.json()).code).toBe('session_not_found');
  });

  it('refuses nobody at all', async () => {
    expect((await wear('', { slot: 'frame' })).status).toBe(404);
  });

  it('refuses an account that has not chosen a pseudonym', async () => {
    // `setWornCosmetic` is an update and not an upsert: a row created here would
    // have no pseudonym, which is the state E.3.2's gate exists to end.
    const ada = await signUp('ada@example.test');

    const answer = await wear(ada.cookie, { slot: 'frame' });

    expect(answer.status).toBe(404);
    expect(await selectWorn(store.db, ada.userId)).toBeNull();
  });

  it('refuses a body that is neither shape', async () => {
    const ada = await player('ada@example.test', [FRAME]);

    expect((await wear(ada.cookie, { cosmeticId: FRAME, slot: 'marker' })).status).toBe(
      200,
    );
    expect((await wear(ada.cookie, {})).status).toBe(400);
    expect((await wear(ada.cookie, { slot: 'hat' })).status).toBe(400);
  });
});
