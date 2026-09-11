// `POST /api/account/pseudonym` — step E.3.2, against a real Postgres and a
// real Better Auth.
//
// The sessions here are made by signing up and by signing in anonymously
// through `auth.handler`, not by faking a cookie: the whole point of the
// handler is that it can tell an account from a guest, and a stubbed session
// would be a test of the stub. `guests.test.ts` sets the same table.
import { selectPseudonym } from '@wikifake/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createAuth } from '../auth/auth.js';
import { handleClaimPseudonym } from './claim.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();
const BASE = 'http://localhost:3000';
const SECRET = 'a-fake-test-signing-secret-32-chars-min';

describe.skipIf(url === null)('E.3.2 — claiming a pseudonym', () => {
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

  const cookieFrom = (response: Response): string =>
    (response.headers.getSetCookie() ?? [])
      .map((raw) => raw.split(';')[0])
      .filter((pair): pair is string => pair !== undefined)
      .join('; ');

  /** An account, through the same endpoint the sign-up screen calls. */
  async function signUp(email: string): Promise<{ cookie: string; userId: string }> {
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

  /** A guest: a real anonymous `user` row, which is 4.3's whole design. */
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

  const claim = (pseudonym: unknown, cookie?: string): Promise<Response> =>
    handleClaimPseudonym(
      { auth: instance, db: store.db },
      new Request(`${BASE}/api/account/pseudonym`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(cookie === undefined ? {} : { cookie }),
        },
        body: JSON.stringify({ pseudonym }),
      }),
    );

  it('gives an account the name it asked for', async () => {
    const { cookie, userId } = await signUp('ada@example.test');

    const response = await claim('Ada Lovelace', cookie);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pseudonym: 'Ada Lovelace' });
    // Written down, and not merely answered: the row is what every other screen
    // reads, so a 200 over an empty table would be the worst possible pass.
    expect(await selectPseudonym(store.db, userId)).toEqual({
      displayName: 'Ada Lovelace',
      displayNameKey: 'ada lovelace',
    });
  });

  it('echoes the name as it was stored, not as it was typed', async () => {
    const { cookie } = await signUp('ada@example.test');

    // `playerName` trims. A screen that went on showing what was typed would be
    // showing a name no other player will ever see.
    expect(await (await claim('  Ada  ', cookie)).json()).toEqual({ pseudonym: 'Ada' });
  });

  it('refuses a name another account holds, whatever the casing', async () => {
    const first = await signUp('ada@example.test');
    await claim('Ada', first.cookie);
    const second = await signUp('bob@example.test');

    const response = await claim('ADA', second.cookie);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'pseudonym_taken' });
  });

  it('leaves the loser of a collision with no pseudonym at all', async () => {
    const first = await signUp('ada@example.test');
    await claim('Ada', first.cookie);
    const second = await signUp('bob@example.test');

    await claim('ada', second.cookie);

    // Not a half-claim and not somebody else's name: the account is exactly
    // where it was, which is what sends it to `/choose-a-name`.
    expect(await selectPseudonym(store.db, second.userId)).toBeNull();
  });

  it('refuses a second name for an account that already has one', async () => {
    const { cookie, userId } = await signUp('ada@example.test');
    await claim('Ada', cookie);

    const response = await claim('Grace', cookie);

    // A claim creates and never renames — E.3.1's decision — so this is the
    // account colliding with its own row.
    expect(response.status).toBe(409);
    expect(await selectPseudonym(store.db, userId)).toMatchObject({
      displayName: 'Ada',
    });
  });

  it('refuses a guest, and spends no name on one', async () => {
    const cookie = await playAsGuest();

    const response = await claim('Ada', cookie);

    // A guest's `user` row is deleted by the anonymous plugin the moment they
    // sign up. A pseudonym spent on it would be held by nobody afterwards, and
    // released by nothing.
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'session_not_found' });
  });

  it('refuses a browser with no session', async () => {
    const response = await claim('Ada');

    // The same answer a guest gets, deliberately: both mean *there is no
    // account here to name*, and both screens send them to the same place.
    expect(response.status).toBe(404);
  });

  it.each([
    ['empty', ''],
    ['only whitespace', '   '],
    ['too long', 'a'.repeat(25)],
    ['a refused character', 'ada<script>'],
    ['not a string', 42],
  ])('refuses a pseudonym that is %s', async (_what, wanted) => {
    const { cookie } = await signUp('ada@example.test');

    const response = await claim(wanted, cookie);

    // `invalid_name` and not `bad_json`: the body was readable and the name was
    // the problem, which is something the player can fix.
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'invalid_name' });
  });

  it('checks the name before it looks for a session', async () => {
    // Order matters for what a caller is told: a signed-out browser sending a
    // name the schema refuses hears about the name, which is the thing it can
    // do something about.
    expect((await claim('')).status).toBe(400);
  });
});
