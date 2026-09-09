// `GET /api/account/export` and `POST /api/account/delete` — step E.7, against a
// real Postgres and a real Better Auth.
//
// `packages/db`'s `account.test.ts` holds what the two queries do to rows. What
// belongs here is the half a query cannot have an opinion about: **who is
// allowed to ask.** The sessions are made through `auth.handler`, because a
// stubbed one would be a test of the stub — and on a route that deletes an
// account, "who is asking" is the whole of the safety.
import { claimPseudonym, selectPseudonym } from '@wikifake/db';
import { playerName } from '@wikifake/protocol';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createAuth } from '../auth/auth.js';
import { deletedPlayerName, handleDelete, handleExport } from './data.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();
const BASE = 'http://localhost:3000';
const SECRET = 'a-fake-test-signing-secret-32-chars-min';
const GONE = 'deleted-1a2b3c4d';

describe.skipIf(url === null)('E.7 — who may export, and who may delete', () => {
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

  const context = () => ({
    auth: instance,
    db: store.db,
    placeholder: () => GONE,
  });

  const cookieFrom = (response: Response): string =>
    (response.headers.getSetCookie() ?? [])
      .map((raw) => raw.split(';')[0])
      .filter((pair): pair is string => pair !== undefined)
      .join('; ');

  async function signUp(email = 'ada@example.test'): Promise<{
    cookie: string;
    userId: string;
  }> {
    const response = await instance.handler(
      new Request(`${BASE}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: 'a-long-enough-password', name: 'x' }),
      }),
    );
    const body = (await response.json()) as { user: { id: string } };
    return { cookie: cookieFrom(response), userId: body.user.id };
  }

  async function playAsGuest(): Promise<string> {
    const response = await instance.handler(
      new Request(`${BASE}/api/auth/sign-in/anonymous`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    );
    return cookieFrom(response);
  }

  const ask = (
    handle: typeof handleExport,
    cookie?: string,
    method = 'GET',
  ): Promise<Response> =>
    handle(
      context(),
      new Request(`${BASE}/api/account/export`, {
        method,
        ...(cookie === undefined ? {} : { headers: { cookie } }),
      }),
    );

  describe('export', () => {
    it('hands an account its own data', async () => {
      const { cookie } = await signUp();

      const response = await ask(handleExport, cookie);

      expect(response.status).toBe(200);
      expect((await response.json()) as { account: { email: string } }).toMatchObject({
        account: { email: 'ada@example.test' },
      });
    });

    it('answers as a file, and asks for it not to be kept', async () => {
      const { cookie } = await signUp();

      const response = await ask(handleExport, cookie);

      // A downloads folder is not a private place, so the name carries no id
      // and no address; and nothing between here and the player should hold a
      // copy of somebody's whole history.
      expect(response.headers.get('content-disposition')).toContain('attachment');
      expect(response.headers.get('content-disposition')).not.toContain('@');
      expect(response.headers.get('cache-control')).toBe('no-store');
    });

    it('refuses a browser with no session', async () => {
      expect((await ask(handleExport)).status).toBe(404);
    });

    it('refuses a guest', async () => {
      const cookie = await playAsGuest();

      // Not because they have no data — they have rounds — but because there is
      // nobody to authenticate as. What a guest's data does is follow them into
      // an account, and then this applies.
      expect((await ask(handleExport, cookie)).status).toBe(404);
    });

    it('is the session that decides, with nothing to pass in', async () => {
      const first = await signUp('ada@example.test');
      await signUp('bob@example.test');

      const response = await ask(handleExport, first.cookie);
      const body = (await response.json()) as { account: { email: string } };

      // There is no parameter naming an account, so there is no authorisation
      // check to get wrong: one session, one answer.
      expect(body.account.email).toBe('ada@example.test');
    });
  });

  describe('delete', () => {
    it('removes the account and says what it left', async () => {
      const { cookie } = await signUp();

      const response = await ask(handleDelete, cookie, 'POST');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ participants: 0, reports: 0 });
    });

    it('leaves the session naming nothing', async () => {
      const { cookie, userId } = await signUp();

      await ask(handleDelete, cookie, 'POST');

      // `session.user_id` cascades, so the cookie in the browser now resolves
      // to no session at all. Asserted through the library rather than the
      // table: what matters is that Better Auth agrees nobody is signed in.
      const after = await instance.api.getSession({ headers: new Headers({ cookie }) });
      expect(after).toBeNull();
      expect(await selectPseudonym(store.db, userId)).toBeNull();
    });

    it('releases the pseudonym', async () => {
      const first = await signUp('ada@example.test');
      await claimPseudonym(store.db, first.userId, 'AdaLovelace');
      const second = await signUp('bob@example.test');

      await ask(handleDelete, first.cookie, 'POST');

      expect((await claimPseudonym(store.db, second.userId, 'AdaLovelace')).ok).toBe(
        true,
      );
    });

    it('refuses a browser with no session', async () => {
      const response = await ask(handleDelete, undefined, 'POST');

      expect(response.status).toBe(404);
    });

    it('refuses a guest, whatever they are holding', async () => {
      const cookie = await playAsGuest();

      // An anonymous session that could delete "its" rows is a deletion
      // anybody's browser could perform on whatever it happened to be holding.
      expect((await ask(handleDelete, cookie, 'POST')).status).toBe(404);
    });

    it('deletes the account that is asking, and no other', async () => {
      const first = await signUp('ada@example.test');
      const second = await signUp('bob@example.test');

      await ask(handleDelete, first.cookie, 'POST');

      const survivor = await instance.api.getSession({
        headers: new Headers({ cookie: second.cookie }),
      });
      expect(survivor?.user.id).toBe(second.userId);
    });
  });

  describe('the name a deleted account leaves behind', () => {
    it('is a name a room could have shown', () => {
      // The column is rendered in a debrief and read by `selectGameHistory`, so
      // a placeholder no room could have shown is a row the rest of the
      // application would have to learn about.
      expect(playerName.safeParse(deletedPlayerName()).success).toBe(true);
    });

    it('is different every time', () => {
      // A fixed string shows two deleted players in one room under one name; a
      // stable one says two rooms held the same person. Neither is a deletion.
      const names = new Set(Array.from({ length: 50 }, () => deletedPlayerName()));
      expect(names.size).toBe(50);
    });
  });
});
