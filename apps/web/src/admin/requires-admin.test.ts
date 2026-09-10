// What everybody who is not an admin is told — step I.1.
//
// The step's whole content, held against a real Postgres and a real Better Auth:
// the sessions are made by signing up and by signing in anonymously through
// `auth.handler`, because a stubbed session would be a test of the stub. The
// shape is `account/gate.test.ts`'s, and its reasoning applies unchanged.
//
// `next/headers` and `next/navigation` are the two things a suite cannot supply
// — there is no request and there is no router — so they are the only mocks, and
// **`notFound` is made to throw the way Next's own does.** A `notFound` that
// returned would let the page render for a stranger, which is precisely the bug
// a gate like this can have.
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

/** Next's `notFound` throws, and so does this one. */
class NotFound extends Error {
  constructor() {
    super('404');
  }
}
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new NotFound();
  },
  redirect: (to: string) => {
    throw new Error(`the panel must not redirect: ${to}`);
  },
}));

const store: { current?: TestDatabase } = {};

// The gate reads the deployment's own auth and its own connection, both pointed
// at the suite's scratch database — the only way to run it against real
// sessions. The mock hands back the *same* instance the fixtures are signed in
// with: two instances mean two configurations, and the bug that matters is a
// gate reading a session some other configuration wrote.
vi.mock('../auth/auth.js', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthModule>()),
  auth: () => instance,
}));
vi.mock('../game/wiring.js', () => ({ db: () => (store.current as TestDatabase).db }));

const { requireAdmin } = await import('./gate.js');
const { admin } = await import('@wikifake/db');
const { createAuth } = await import('../auth/auth.js');

let instance: ReturnType<typeof createAuth>;

describe.skipIf(url === null)('I.1 — a route only an admin reaches', () => {
  beforeAll(async () => {
    store.current = await openWebTestDatabase();
    instance = createAuth({ db: store.current.db, secret: SECRET, baseURL: BASE });
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

  async function signInAsGuest(): Promise<void> {
    const response = await instance.handler(
      new Request(`${BASE}/api/auth/sign-in/anonymous`, { method: 'POST' }),
    );
    cookie = cookieFrom(response);
  }

  const grant = (userId: string) =>
    (store.current as TestDatabase).db.insert(admin).values({ userId });

  it('lets an admin in, and says who they are', async () => {
    const userId = await signUp();
    await grant(userId);

    await expect(requireAdmin()).resolves.toEqual({ userId });
  });

  it('answers 404 to nobody at all', async () => {
    await expect(requireAdmin()).rejects.toBeInstanceOf(NotFound);
  });

  it('answers 404 to a signed-in account that was never granted it', async () => {
    // **Not 403.** A 403 tells a stranger they have found the right address and
    // only lack the right account, which is the half of the answer worth
    // having. This is the case that decision is about.
    await signUp();

    await expect(requireAdmin()).rejects.toBeInstanceOf(NotFound);
  });

  it('answers 404 to a guest', async () => {
    await signInAsGuest();

    await expect(requireAdmin()).rejects.toBeInstanceOf(NotFound);
  });

  it('ignores a grant made to a guest, rather than merely discouraging one', async () => {
    /*
     * The case that makes the `isAnonymous` check load-bearing, and a mutation
     * found that it was not: deleting the check passed every other case here,
     * because a guest is not in `admin` anyway.
     *
     * So it is tested on the one input where the two differ. A guest *can* be
     * granted it — `admin.user_id` is a `user` id and a guest has one — and it
     * must not work, because the anonymous plugin deletes that row the moment
     * they sign up: an admin guest is an admin who disappears, and worse, whose
     * privilege was attached to a browser rather than to a person.
     */
    await signInAsGuest();
    const session = await instance.api.getSession({
      headers: new Headers({ cookie }),
    });
    await grant((session as { user: { id: string } }).user.id);

    await expect(requireAdmin()).rejects.toBeInstanceOf(NotFound);
  });

  it('answers 404 with a cookie that is not a session', async () => {
    cookie = 'better-auth.session_token=not-a-real-token';

    await expect(requireAdmin()).rejects.toBeInstanceOf(NotFound);
  });

  it('stops letting somebody in the moment the row is deleted', async () => {
    // The answer is never cached. A stale *yes* in a cookie is a way in that
    // outlives the row being deleted, and what caching would save is one hit on
    // a primary key.
    const userId = await signUp();
    await grant(userId);
    await expect(requireAdmin()).resolves.toEqual({ userId });

    await (store.current as TestDatabase).db.delete(admin);

    await expect(requireAdmin()).rejects.toBeInstanceOf(NotFound);
  });

  it('does not let one account in on another’s grant', async () => {
    const ada = await signUp('ada@example.test');
    await grant(ada);
    // Bob's cookie, Ada's grant.
    await signUp('bob@example.test');

    await expect(requireAdmin()).rejects.toBeInstanceOf(NotFound);
  });

  it('never redirects, whatever the answer', async () => {
    // The mock throws a different error for a redirect, so a gate that sent
    // somebody to `/sign-in` would fail here rather than pass as a 404. Every
    // other gated page in this application redirects, and each redirect is an
    // answer this one is withholding.
    await signUp();

    await expect(requireAdmin()).rejects.not.toMatchObject({
      message: expect.stringContaining('must not redirect'),
    });
  });
});
