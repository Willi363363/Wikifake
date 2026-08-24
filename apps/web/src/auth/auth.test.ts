// 4.2's criterion: creating an account, opening then closing a session, against
// the database.
//
// Driven through `auth.handler` with real `Request` objects rather than through
// the typed `api` helpers, because what the step delivers is *mounted routes*.
// A test that calls the helpers would pass with the routes unmounted.
import { account, session, user } from '@wikifake/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createAuth } from './auth.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();
const BASE = 'http://localhost:3000';
const SECRET = 'a-fake-test-signing-secret-32-chars-min';

const CREDENTIALS = {
  name: 'Élise Dupont',
  email: 'elise@example.test',
  password: 'un-mot-de-passe-assez-long',
};

describe.skipIf(url === null)('4.2 — Better Auth on the project database', () => {
  let store: TestDatabase;
  let handler: (request: Request) => Promise<Response>;

  beforeAll(async () => {
    store = await openWebTestDatabase();
    const instance = createAuth({ db: store.db, secret: SECRET, baseURL: BASE });
    handler = (request) => instance.handler(request);
  });

  beforeEach(async () => {
    await store.truncate();
  });

  afterAll(async () => {
    await store.close();
  });

  const post = (path: string, body: unknown, cookie?: string): Promise<Response> =>
    handler(
      new Request(`${BASE}/api/auth/${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(cookie === undefined ? {} : { cookie }),
        },
        body: JSON.stringify(body),
      }),
    );

  const get = (path: string, cookie?: string): Promise<Response> =>
    handler(
      new Request(`${BASE}/api/auth/${path}`, {
        headers: cookie === undefined ? {} : { cookie },
      }),
    );

  /** The cookie jar as a request header, from a response that set one. */
  const cookieFrom = (response: Response): string =>
    (response.headers.getSetCookie() ?? [])
      .map((raw) => raw.split(';')[0])
      .filter((pair): pair is string => pair !== undefined)
      .join('; ');

  it('creates an account in the project tables', async () => {
    const response = await post('sign-up/email', CREDENTIALS);
    expect(response.status).toBe(200);

    // In *these* tables, which is the whole point of the step: the schema phase 2
    // laid down, not a schema the library brought with it.
    const users = await store.db.select().from(user);
    expect(users).toHaveLength(1);
    expect(users[0]?.email).toBe(CREDENTIALS.email);
    expect(users[0]?.name).toBe(CREDENTIALS.name);

    // And a credential account beside it, with the password hashed rather than
    // stored. `issuer` is NOT NULL in our schema — this is what proves phase 2's
    // guess about Better Auth's core shape was right.
    const accounts = await store.db.select().from(account);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.userId).toBe(users[0]?.id);
    expect(accounts[0]?.password).not.toBe(CREDENTIALS.password);
    expect(accounts[0]?.password ?? '').not.toBe('');
  });

  // Worth pinning, because it is not obvious and 4.3 depends on it: signing up
  // **also signs you in**. Every count below is relative to that.
  it('signs the new account in as it creates it', async () => {
    await post('sign-up/email', CREDENTIALS);
    expect(await store.db.select().from(session)).toHaveLength(1);
  });

  it('opens a session, and the session is a row', async () => {
    await post('sign-up/email', CREDENTIALS);
    const signedIn = await post('sign-in/email', {
      email: CREDENTIALS.email,
      password: CREDENTIALS.password,
    });

    expect(signedIn.status).toBe(200);
    const cookie = cookieFrom(signedIn);
    expect(cookie).not.toBe('');

    // Two now: the one sign-up opened, and this one.
    const sessions = await store.db.select().from(session);
    expect(sessions).toHaveLength(2);
    for (const row of sessions) {
      expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now());
    }

    const mine = await get('get-session', cookie);
    const body = (await mine.json()) as { user?: { email?: string } } | null;
    expect(body?.user?.email).toBe(CREDENTIALS.email);
  });

  it('closes that session, and its row goes with it', async () => {
    const signedUp = await post('sign-up/email', CREDENTIALS);
    const fromSignUp = cookieFrom(signedUp);
    const cookie = cookieFrom(
      await post('sign-in/email', {
        email: CREDENTIALS.email,
        password: CREDENTIALS.password,
      }),
    );

    const before = (await store.db.select().from(session)).map((row) => row.token);
    expect(before).toHaveLength(2);

    const out = await post('sign-out', {}, cookie);
    expect(out.status).toBe(200);

    // Not merely "the cookie was cleared": a session left in the table is a way
    // back in for anyone who kept the token. And signing out of one session must
    // not sign the account out of its others — that would log a player out of
    // their phone because they closed a tab.
    const after = (await store.db.select().from(session)).map((row) => row.token);
    expect(after).toHaveLength(1);
    expect(before.filter((token) => !after.includes(token))).toHaveLength(1);

    const denied = await get('get-session', cookie);
    const body = (await denied.json()) as { user?: unknown } | null;
    expect(body?.user).toBeUndefined();

    // The other session still works.
    const other = await get('get-session', fromSignUp);
    const stillMine = (await other.json()) as { user?: { email?: string } } | null;
    expect(stillMine?.user?.email).toBe(CREDENTIALS.email);
  });

  it('refuses the wrong password, and opens nothing', async () => {
    await post('sign-up/email', CREDENTIALS);
    const denied = await post('sign-in/email', {
      email: CREDENTIALS.email,
      password: 'pas-le-bon-mot-de-passe',
    });

    expect(denied.status).toBeGreaterThanOrEqual(400);
    expect(cookieFrom(denied)).toBe('');
    // Still just the one sign-up opened: a rejected attempt must add no session.
    expect(await store.db.select().from(session)).toHaveLength(1);
  });

  it('refuses a second account on the same address', async () => {
    expect((await post('sign-up/email', CREDENTIALS)).status).toBe(200);
    const again = await post('sign-up/email', {
      ...CREDENTIALS,
      name: 'Quelqu un d autre',
    });

    expect(again.status).toBeGreaterThanOrEqual(400);
    expect(await store.db.select().from(user)).toHaveLength(1);
  });
});
