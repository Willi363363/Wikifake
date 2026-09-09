// The three kinds of viewer, and the one that is stopped — step E.3.2.
//
// **A `profile` row is a pseudonym that has been chosen**, so its absence is
// what marks an account that has not chosen one. This suite is that sentence,
// held to a real Postgres and a real Better Auth: the sessions are made by
// signing up and by signing in anonymously through `auth.handler`, because a
// stubbed session would be a test of the stub.
//
// `next/headers` and `next/navigation` are the two things a suite cannot supply
// — there is no request and there is no router — so they are the only mocks,
// and `redirect` is made to throw the way Next's own does. A `redirect` that
// returned would let the code after it run, which is precisely the bug a gate
// can have.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type * as AuthModule from '../auth/auth.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();
const BASE = 'http://localhost:3000';
const SECRET = 'a-fake-test-signing-secret-32-chars-min';

/** The cookie the current test is pretending the browser sent. */
let cookie = '';

vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Headers(cookie === '' ? {} : { cookie })),
}));

/** Next's `redirect` throws, and so does this one: code after it must not run. */
class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirect: ${to}`);
  }
}
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Redirected(to);
  },
}));

const store: { current?: TestDatabase } = {};

// The gate reads the deployment's own auth and its own connection. Both are
// pointed at the suite's scratch database, which is the only way to run it
// against real sessions — `auth()` would otherwise validate the environment and
// open the deployment's connection.
//
// The mock hands back the **same** instance the suite signs its fixtures in
// with. A second one built over the same database would work, and would also be
// the one place this suite could pass while production could not: two instances
// mean two configurations, and the bug that matters is the gate reading a
// session some other configuration wrote.
vi.mock('../auth/auth.js', async (importOriginal) => ({
  // `createAuth` is the real one: the suite calls it to build the instance, and
  // a stub of it would leave `auth.handler` — which mints every session here —
  // untested.
  ...(await importOriginal<typeof AuthModule>()),
  auth: () => instance,
}));
vi.mock('../game/wiring.js', () => ({ db: () => (store.current as TestDatabase).db }));

const { CHOOSE_A_NAME, readViewer, requirePseudonym } = await import('./gate.js');
const { claimPseudonym } = await import('@wikifake/db');
const { createAuth } = await import('../auth/auth.js');

/** Built in `beforeAll`, and read by the mock above when the gate calls it. */
let instance: ReturnType<typeof createAuth>;

describe.skipIf(url === null)('E.3.2 — who is asking, and what they are called', () => {
  beforeAll(async () => {
    store.current = await openWebTestDatabase();
    instance = createAuth({
      db: store.current.db,
      secret: SECRET,
      baseURL: BASE,
    });
  });

  beforeEach(async () => {
    await (store.current as TestDatabase).truncate();
    cookie = '';
  });

  afterAll(async () => {
    await (store.current as TestDatabase).close();
  });

  const cookieFrom = (response: Response): string =>
    (response.headers.getSetCookie() ?? [])
      .map((raw) => raw.split(';')[0])
      .filter((pair): pair is string => pair !== undefined)
      .join('; ');

  /** Signs an account up and puts its cookie on the next request. */
  async function signUp(email = 'ada@example.test'): Promise<string> {
    const response = await instance.handler(
      new Request(`${BASE}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: 'a-long-enough-password', name: 'x' }),
      }),
    );
    cookie = cookieFrom(response);
    const body = (await response.json()) as { user: { id: string } };
    return body.user.id;
  }

  /** Signs in as a guest and puts its cookie on the next request. */
  async function playAsGuest(): Promise<void> {
    const response = await instance.handler(
      new Request(`${BASE}/api/auth/sign-in/anonymous`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    );
    cookie = cookieFrom(response);
  }

  describe('readViewer', () => {
    it('calls a browser with no session a stranger', async () => {
      expect(await readViewer()).toEqual({ kind: 'anonymous' });
    });

    it('calls an anonymous session a guest, and gives it no pseudonym', async () => {
      await playAsGuest();

      const viewer = await readViewer();

      // 4.3: a guest holds a real `user` row so their games follow them into an
      // account. It is not a pseudonym, and it is never asked for one.
      expect(viewer.kind).toBe('guest');
      expect(viewer.userId).toBeDefined();
      expect(viewer.pseudonym).toBeUndefined();
    });

    it('calls a real session an account, with no name until one is claimed', async () => {
      await signUp();

      // Every account that arrives through Google is in exactly this state.
      // The key is absent rather than undefined, which is the shape the gate
      // then tests: `pseudonym === undefined` is the whole redirect condition.
      const viewer = await readViewer();
      expect(viewer.kind).toBe('account');
      expect(viewer.pseudonym).toBeUndefined();
    });

    it('reads the pseudonym once it has been claimed', async () => {
      const userId = await signUp();
      await claimPseudonym((store.current as TestDatabase).db, userId, 'Ada');

      expect(await readViewer()).toMatchObject({ kind: 'account', pseudonym: 'Ada' });
    });

    it('reads the name as stored, not as it was folded', async () => {
      const userId = await signUp();
      await claimPseudonym((store.current as TestDatabase).db, userId, 'Ada Lovelace');

      // The key is for the constraint; what a screen shows is the capitals
      // their owner typed.
      expect((await readViewer()).pseudonym).toBe('Ada Lovelace');
    });
  });

  describe('requirePseudonym', () => {
    it('sends an account with no pseudonym to the screen that asks', async () => {
      await signUp();

      await expect(requirePseudonym()).rejects.toThrow(
        new RegExp(`redirect: ${CHOOSE_A_NAME}`),
      );
    });

    it('lets an account with one through', async () => {
      const userId = await signUp();
      await claimPseudonym((store.current as TestDatabase).db, userId, 'Ada');

      expect(await requirePseudonym()).toMatchObject({ pseudonym: 'Ada' });
    });

    it('lets a guest straight through', async () => {
      await playAsGuest();

      // A game playable without signing up is one of this effort's three
      // conditions for done. A gate that stopped everybody without a pseudonym
      // would end that on the day it shipped.
      expect((await requirePseudonym()).kind).toBe('guest');
    });

    it('lets a browser with no session straight through', async () => {
      // The lobby creates a guest when a game starts. Being asked to choose a
      // pseudonym before being asked to sign up would be the wrong order.
      expect((await requirePseudonym()).kind).toBe('anonymous');
    });
  });
});
