// `POST /api/realtime/ticket` — steps E.3b.2 and E.3.3, against a real Postgres
// and a real Better Auth.
//
// The rule this suite exists for is E.3.3's: **a signed-in player is shown
// under their pseudonym and under no other name**, whatever their browser asks
// for. It is asserted here rather than on a screen because it is the server's
// guarantee — the lobby not offering a field is a courtesy on top of it, and a
// courtesy is not something a room can rely on.
//
// The sessions are made through `auth.handler`, and the tickets are read back
// with `readTicket` rather than by parsing a string: what a ticket *is* belongs
// to `@wikifake/tickets`, and a test that decoded one by hand would be a second
// implementation of the format.
import { claimPseudonym } from '@wikifake/db';
import { readTicket } from '@wikifake/tickets';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createAuth } from '../auth/auth.js';
import { handleTicket } from './ticket-handler.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();
const BASE = 'http://localhost:3000';
const SECRET = 'a-fake-test-signing-secret-32-chars-min';
const NOW = Date.UTC(2026, 8, 9, 12, 0, 0);

describe.skipIf(url === null)('E.3.3 — the name a room shows', () => {
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

  /** An account, optionally with the pseudonym E.3.2 would have claimed for it. */
  async function signUp(
    email: string,
    pseudonym?: string,
  ): Promise<{ cookie: string; userId: string }> {
    const response = await instance.handler(
      new Request(`${BASE}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: 'a-long-enough-password', name: 'x' }),
      }),
    );
    const body = (await response.json()) as { user: { id: string } };
    if (pseudonym !== undefined) {
      await claimPseudonym(store.db, body.user.id, pseudonym);
    }
    return { cookie: cookieFrom(response), userId: body.user.id };
  }

  const ask = (name: string, cookie?: string, room = 'A1B2C3'): Promise<Response> =>
    handleTicket(
      { auth: instance, db: store.db, secret: SECRET, now: () => NOW },
      new Request(`${BASE}/api/realtime/ticket?room=${room}&name=${name}`, {
        method: 'POST',
        ...(cookie === undefined ? {} : { headers: { cookie } }),
      }),
    );

  /** What the answer says, and what its ticket says, which must agree. */
  async function answered(
    response: Response,
    room = 'A1B2C3',
  ): Promise<{ playerName: string; signedFor: string | null }> {
    const body = (await response.json()) as { ticket: string; playerName: string };
    const read = readTicket(
      SECRET,
      body.ticket,
      { roomCode: room, playerName: body.playerName },
      NOW,
    );
    return { playerName: body.playerName, signedFor: read?.playerName ?? null };
  }

  it('shows a signed-in player their pseudonym, not what they asked for', async () => {
    const { cookie } = await signUp('ada@example.test', 'AdaLovelace');

    const response = await ask('somebodyelse', cookie);

    // The whole step: a room shows an account under one name, and it is the one
    // every other screen shows them under.
    expect(await answered(response)).toEqual({
      playerName: 'AdaLovelace',
      signedFor: 'AdaLovelace',
    });
  });

  it('signs the ticket for the substituted name, not the requested one', async () => {
    const { cookie } = await signUp('ada@example.test', 'AdaLovelace');

    const body = (await (await ask('somebodyelse', cookie)).json()) as {
      ticket: string;
    };

    // A ticket minted for the name that was asked for would verify against
    // nothing: the socket carries the substituted one. The two halves of the
    // answer have to be one decision, and this is what says they are.
    expect(
      readTicket(
        SECRET,
        body.ticket,
        { roomCode: 'A1B2C3', playerName: 'somebodyelse' },
        NOW,
      ),
    ).toBeNull();
  });

  it('substitutes whatever the casing of the request', async () => {
    const { cookie } = await signUp('ada@example.test', 'AdaLovelace');

    // Not a comparison the handler makes — it does not compare at all. The
    // pseudonym is simply the answer, so there is no fold to get wrong here.
    expect((await answered(await ask('adalovelace', cookie))).playerName).toBe(
      'AdaLovelace',
    );
  });

  it('leaves a guest the name they typed', async () => {
    // No cookie at all: `identify` creates the anonymous `user` row 4.3 asks
    // for, and a guest has no pseudonym to be shown instead.
    expect((await answered(await ask('ada'))).playerName).toBe('ada');
  });

  it('gives a guest an identity, so the round can be attached later', async () => {
    const response = await ask('ada');
    const body = (await response.json()) as { ticket: string };

    const read = readTicket(
      SECRET,
      body.ticket,
      { roomCode: 'A1B2C3', playerName: 'ada' },
      NOW,
    );

    // A room player never given a `user` row is a round that can never follow
    // them into an account — multiplayer catching up with solo, since 4.3.
    expect(read?.userId).toBeTruthy();
    expect(response.headers.getSetCookie().length).toBeGreaterThan(0);
  });

  it('leaves an account with no pseudonym the name it typed', async () => {
    // E.3.2's gate should have caught this before a room, and the ticket route
    // is not the place to enforce a screen's redirect: it answers with what it
    // has, which is the requested name and a real account to credit.
    const { cookie } = await signUp('ada@example.test');

    expect((await answered(await ask('ada', cookie))).playerName).toBe('ada');
  });

  it('credits the account behind a signed-in player', async () => {
    const { cookie, userId } = await signUp('ada@example.test', 'AdaLovelace');

    const body = (await (await ask('AdaLovelace', cookie)).json()) as { ticket: string };
    const read = readTicket(
      SECRET,
      body.ticket,
      { roomCode: 'A1B2C3', playerName: 'AdaLovelace' },
      NOW,
    );

    expect(read?.userId).toBe(userId);
  });

  it.each([
    ['no room', '?name=ada'],
    ['a room that is not a code', '?room=nope&name=ada'],
    ['no name', '?room=A1B2C3'],
    ['a name the protocol refuses', '?room=A1B2C3&name=' + encodeURIComponent('a@b')],
  ])('refuses %s', async (_what, query) => {
    const response = await handleTicket(
      { auth: instance, db: store.db, secret: SECRET, now: () => NOW },
      new Request(`${BASE}/api/realtime/ticket${query}`, { method: 'POST' }),
    );

    // Refused rather than answered with a ticket bound to values the socket
    // will not carry, which is a ticket that silently never verifies.
    expect(response.status).toBe(400);
  });
});
