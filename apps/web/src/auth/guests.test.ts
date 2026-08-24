// 4.3's criterion: a game played as a guest appears in the history of the
// account created afterwards.
//
// Driven through `auth.handler`, because the linking is a Better Auth hook and a
// test that called `attachGuestRecords` directly would prove only that the
// function works — not that anything ever calls it.
// The ORM is deliberately absent from this application's dependencies — phase
// 2's exit gate: no free-form SQL outside `@wikifake/db`. Every read here has a
// name over there. The two inserts below are fixtures; step 4.4 gives the writes
// their own exported queries.
import { game, participant, selectGameHistory, selectUserById } from '@wikifake/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createAuth } from './auth.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();
const BASE = 'http://localhost:3000';
const SECRET = 'a-fake-test-signing-secret-32-chars-min';

describe.skipIf(url === null)('4.3 — a guest who signs up afterwards', () => {
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

  const cookieFrom = (response: Response): string =>
    (response.headers.getSetCookie() ?? [])
      .map((raw) => raw.split(';')[0])
      .filter((pair): pair is string => pair !== undefined)
      .join('; ');

  /** Signs in as a guest and returns their cookie and their user id. */
  async function playAsGuest(): Promise<{ cookie: string; userId: string }> {
    const response = await post('sign-in/anonymous', {});
    expect(response.status).toBe(200);

    const body = (await response.json()) as { user?: { id?: string } };
    const userId = body.user?.id;
    if (userId === undefined) throw new Error('the guest has no id');

    return { cookie: cookieFrom(response), userId };
  }

  /** A finished game, played under a nickname, by whoever this id is. */
  async function recordGame(
    userId: string,
    topic: string,
    playedAs: string,
  ): Promise<void> {
    const [row] = await store.db
      .insert(game)
      .values({
        mode: 'solo',
        topic,
        sourceUrl: `https://fr.wikipedia.org/wiki/${topic}`,
        paragraphs: ['un paragraphe falsifié'],
        totalFakes: 2,
        timeLimit: 300,
        endedAt: new Date(),
      })
      .returning({ id: game.id });
    if (row === undefined) throw new Error('no game');

    await store.db.insert(participant).values({
      gameId: row.id,
      userId,
      guestName: playedAs,
      colour: '#ff8800',
      submittedAt: new Date(),
      score: 400,
      truePositives: 3,
      falsePositives: 1,
      hintsUsed: 0,
      hintPenalty: 0,
      scoreStolen: 0,
      timeBonus: 100,
    });
  }

  it('gives a guest an identity, not just a nickname', async () => {
    const guest = await playAsGuest();

    const [row] = await selectUserById(store.db, guest.userId);
    // A row, and marked as what it is. Two guests typing the same nickname are
    // two identities, which is the whole reason this exists.
    expect(row?.isAnonymous).toBe(true);
    expect(guest.cookie).not.toBe('');
  });

  it('carries the game into the account created afterwards', async () => {
    const guest = await playAsGuest();
    await recordGame(guest.userId, 'Chocolat', 'Élise');

    const signedUp = await post(
      'sign-up/email',
      {
        name: 'Élise Dupont',
        email: 'elise@example.test',
        password: 'un-mot-de-passe-assez-long',
      },
      guest.cookie,
    );
    expect(signedUp.status).toBe(200);

    const account = (await signedUp.json()) as { user?: { id?: string } };
    const accountId = account.user?.id;
    expect(accountId).toBeDefined();
    expect(accountId).not.toBe(guest.userId);

    const history = await selectGameHistory(store.db, accountId as string);
    expect(history).toHaveLength(1);
    expect(history[0]?.topic).toBe('Chocolat');
    expect(history[0]?.score).toBe(400);
    // The name they played under survives: it is what the other players saw.
    expect(history[0]?.playedAs).toBe('Élise');
  });

  it('leaves nothing behind under the guest identity', async () => {
    const guest = await playAsGuest();
    await recordGame(guest.userId, 'Chocolat', 'Élise');

    await post(
      'sign-up/email',
      { name: 'Élise', email: 'elise2@example.test', password: 'un-mot-de-passe-long' },
      guest.cookie,
    );

    // The plugin deletes the anonymous row once the account is real. That delete
    // is what the old "exactly one" check would have aborted, and it is why the
    // hook has to run first.
    expect(await selectUserById(store.db, guest.userId)).toEqual([]);
    expect(await selectGameHistory(store.db, guest.userId)).toEqual([]);
  });

  it('keeps two guests apart even under the same nickname', async () => {
    const first = await playAsGuest();
    const second = await playAsGuest();
    expect(first.userId).not.toBe(second.userId);

    await recordGame(first.userId, 'Chocolat', 'Élise');
    await recordGame(second.userId, 'Chat', 'Élise');

    const signedUp = await post(
      'sign-up/email',
      {
        name: 'La première',
        email: 'first@example.test',
        password: 'un-mot-de-passe-long',
      },
      first.cookie,
    );
    const account = (await signedUp.json()) as { user?: { id?: string } };

    // Only the first guest's game. A nickname-based scheme would have taken both.
    const history = await selectGameHistory(store.db, account.user?.id as string);
    expect(history.map((row) => row.topic)).toEqual(['Chocolat']);
  });

  it('does not attach anything when there was no guest session', async () => {
    const signedUp = await post('sign-up/email', {
      name: 'Quelqu un',
      email: 'direct@example.test',
      password: 'un-mot-de-passe-assez-long',
    });
    const account = (await signedUp.json()) as { user?: { id?: string } };

    expect(await selectGameHistory(store.db, account.user?.id as string)).toEqual([]);
  });
});
