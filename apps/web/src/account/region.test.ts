// The region a player is ranked in — step G.1, through the handler.
//
// Two halves, and they are wired in different places on purpose. The header is
// read where the `profile` row is *created* — `handleClaimPseudonym` — so the
// inference happens once and never follows a travelling player. The choice is
// this handler, and it always wins.
//
// The session is real rather than mocked: `createAuth` over the same test
// database, the shape `guests.test.ts` established.
import { selectRegions } from '@wikifake/db';
import { effectiveRegion } from '@wikifake/domain';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createAuth } from '../auth/auth.js';
import { handleClaimPseudonym } from './claim.js';
import { handleChooseRegion } from './region.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();
const BASE = 'http://localhost:3000';
const SECRET = 'a-fake-test-signing-secret-32-chars-min';

describe.skipIf(url === null)('G.1 — a player’s region', () => {
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

  const context = () => ({ auth: instance, db: store.db });

  /** Claiming a pseudonym, with or without a country on the request. */
  const claimName = (
    pseudonym: string,
    cookie: string,
    country?: string,
  ): Promise<Response> =>
    handleClaimPseudonym(
      context(),
      new Request(`${BASE}/api/account/pseudonym`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie,
          ...(country === undefined ? {} : { 'x-vercel-ip-country': country }),
        },
        body: JSON.stringify({ pseudonym }),
      }),
    );

  const chooseRegion = (region: string, cookie?: string): Promise<Response> =>
    handleChooseRegion(
      context(),
      new Request(`${BASE}/api/account/region`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(cookie === undefined ? {} : { cookie }),
        },
        body: JSON.stringify({ region }),
      }),
    );

  const regionOf = async (userId: string): Promise<string> => {
    const rows = await selectRegions(store.db, userId);
    if (rows === null) throw new Error('no profile');
    return effectiveRegion(rows);
  };

  describe('derived where the row is created', () => {
    it('reads the country the CDN put on the request', async () => {
      const ada = await signUp('ada@example.test');

      expect((await claimName('Ada', ada.cookie, 'FR')).status).toBe(200);

      expect(await regionOf(ada.userId)).toBe('europe');
      expect((await selectRegions(store.db, ada.userId))?.chosenRegion).toBeNull();
    });

    it('ranks a player the header cannot place, rather than refusing them', async () => {
      // No header at all, which is every local run and every deployment behind
      // a different CDN.
      const ada = await signUp('ada@example.test');
      await claimName('Ada', ada.cookie);

      expect(await regionOf(ada.userId)).toBe('other');
    });

    it('does not re-derive on a later request', async () => {
      /*
       * The travelling player. `claimPseudonym` creates and never renames — E.3.2
       * — so a second claim from another country is refused as taken *and*
       * leaves the region alone. That is the property, from the only path that
       * could have broken it.
       */
      const ada = await signUp('ada@example.test');
      await claimName('Ada', ada.cookie, 'FR');

      const again = await claimName('Ada', ada.cookie, 'US');
      expect(again.status).toBe(409);

      expect(await regionOf(ada.userId)).toBe('europe');
    });
  });

  describe('chosen, and the choice wins', () => {
    it('records the region a player picks', async () => {
      const ada = await signUp('ada@example.test');
      await claimName('Ada', ada.cookie, 'FR');

      const answer = await chooseRegion('americas', ada.cookie);

      expect(answer.status).toBe(200);
      expect(await answer.json()).toEqual({ region: 'americas' });
      // The inference is still there, and still ignored.
      const rows = await selectRegions(store.db, ada.userId);
      expect(rows?.derivedRegion).toBe('europe');
      expect(await regionOf(ada.userId)).toBe('americas');
    });

    it('lets a player change their mind', async () => {
      const ada = await signUp('ada@example.test');
      await claimName('Ada', ada.cookie, 'FR');
      await chooseRegion('americas', ada.cookie);

      await chooseRegion('other', ada.cookie);

      expect(await regionOf(ada.userId)).toBe('other');
    });

    it('refuses a region nobody offers', async () => {
      // The closed list is `protocol`'s, and it is what stands in for a Postgres
      // enum the columns deliberately do not have.
      const ada = await signUp('ada@example.test');
      await claimName('Ada', ada.cookie, 'FR');

      const answer = await chooseRegion('atlantis', ada.cookie);

      expect(answer.status).toBe(400);
      expect(await answer.json()).toMatchObject({ code: 'bad_json' });
      expect(await regionOf(ada.userId)).toBe('europe');
    });

    it('refuses a request with no session', async () => {
      const answer = await chooseRegion('europe');

      expect(answer.status).toBe(404);
      expect(await answer.json()).toMatchObject({ code: 'session_not_found' });
    });

    it('refuses a guest, who has no account to rank', async () => {
      /*
       * A guest holds a real `user` row — 4.3's design — so a session exists.
       * They are refused twice over, and only the first is visible here: the
       * explicit `isAnonymous` check, and then `setChosenRegion` finding no
       * `profile` row to update. A mutation removing the explicit check passes
       * this case for that reason, which makes it a short-circuit rather than
       * the guarantee — the same shape F.6's already-claimed check has.
       *
       * It stays because the two refusals are not the same claim: one says *a
       * guest has no account*, and the other says *this account has no
       * pseudonym*. The day a guest can hold a profile row, only the first is
       * still true.
       */
      const answer = await instance.handler(
        new Request(`${BASE}/api/auth/sign-in/anonymous`, { method: 'POST' }),
      );
      const cookie = (answer.headers.getSetCookie() ?? [])
        .map((raw) => raw.split(';')[0])
        .filter((pair): pair is string => pair !== undefined)
        .join('; ');

      const refused = await chooseRegion('europe', cookie);

      expect(refused.status).toBe(404);
      expect(await refused.json()).toMatchObject({ code: 'session_not_found' });
    });

    it('refuses an account that has not chosen a pseudonym', async () => {
      // No `profile` row, so nothing to update. E.3.2's gate sends that account
      // to choose a name before it reaches anything else, and creating a row
      // here would create the very state that gate exists to end.
      const ada = await signUp('ada@example.test');

      const answer = await chooseRegion('europe', ada.cookie);

      expect(answer.status).toBe(404);
      expect(await selectRegions(store.db, ada.userId)).toBeNull();
    });

    it('touches nobody else’s region', async () => {
      const ada = await signUp('ada@example.test');
      const bob = await signUp('bob@example.test');
      await claimName('Ada', ada.cookie, 'FR');
      await claimName('Bob', bob.cookie, 'US');

      await chooseRegion('other', ada.cookie);

      expect(await regionOf(ada.userId)).toBe('other');
      expect(await regionOf(bob.userId)).toBe('americas');
    });
  });
});
