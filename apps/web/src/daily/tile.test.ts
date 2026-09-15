// What the home tile knows about today — step N.7, against a real Postgres.
//
// The assertion that matters most is the one about what it does *not* do: a
// dashboard that generated the day would buy an article on a quiet morning, and
// again for every crawler.
import {
  claimDay,
  fillDay,
  createGame,
  recordEligibleScore,
  user,
  profile,
} from '@wikifake/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { readDailyTile } from './tile.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();

const AT = Date.UTC(2026, 8, 10, 4, 0, 0);
const DAY = 20_706;

const SOLUTION = [
  {
    paragraphIndex: 1,
    falseInfoNumber: 1,
    falseStatement: 'faux',
    originalText: 'vrai',
    explanation: 'parce que',
    hint: 'un indice',
  },
];

describe.skipIf(url === null)('N.7 — today, as a tile sees it', () => {
  let store: TestDatabase;

  beforeAll(async () => {
    store = await openWebTestDatabase();
  });
  beforeEach(async () => {
    await store.truncate();
  });
  afterAll(async () => {
    await store.close();
  });

  const makeDay = async (): Promise<void> => {
    await claimDay(store.db, DAY, new Date(AT));
    await fillDay(
      store.db,
      DAY,
      {
        topic: 'Chat',
        sourceUrl: 'https://fr.wikipedia.org/wiki/Chat',
        paragraphs: ['un', 'deux', 'trois'],
        solution: SOLUTION,
        totalFakes: 1,
      },
      new Date(AT),
    );
  };

  const addPlayer = async (id: string): Promise<void> => {
    await store.db
      .insert(user)
      .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
    await store.db
      .insert(profile)
      .values({ userId: id, displayName: id, displayNameKey: id });
  };

  const played = async (userId: string, score: number | null): Promise<void> => {
    const started = await createGame(store.db, {
      mode: 'solo',
      topic: 'Chat',
      sourceUrl: 'https://fr.wikipedia.org/wiki/Chat',
      paragraphs: ['un', 'deux', 'trois'],
      timeLimit: 300,
      fromCache: true,
      solution: SOLUTION,
      dailyDay: DAY,
      players: [{ userId, colour: '#1f574d' }],
    });

    if (score === null) return;
    await recordEligibleScore(store.db, {
      participantId: started.participantIds[0] as string,
      userId,
      mode: 'solo',
      score,
      finishedAt: new Date(AT),
    });
  };

  /*
   * The decision this file exists to hold. `ensureDailyArticle` claims the day
   * and calls a model; a dashboard that used it would buy an article on a quiet
   * morning, and again for every crawler and preflight request.
   */
  it('says the day is not ready rather than making one', async () => {
    const tile = await readDailyTile({ db: store.db }, null, AT);

    expect(tile.topic).toBeNull();
    // The proof nothing was claimed: the day is still there to be taken.
    expect(await claimDay(store.db, DAY, new Date(AT))).toBe(true);
  });

  it('names the article once the day has one', async () => {
    await makeDay();

    expect((await readDailyTile({ db: store.db }, null, AT)).topic).toBe('Chat');
  });

  it('gives a guest the article and no standing', async () => {
    await makeDay();
    await addPlayer('ada');
    await played('ada', 500);

    const tile = await readDailyTile({ db: store.db }, null, AT);

    expect(tile).toMatchObject({ topic: 'Chat', played: false, rank: null, players: 1 });
  });

  it('says where a player stands once they have finished', async () => {
    await makeDay();
    await addPlayer('ada');
    await addPlayer('grace');
    await played('grace', 900);
    await played('ada', 300);

    expect(await readDailyTile({ db: store.db }, 'ada', AT)).toMatchObject({
      played: true,
      rank: 2,
      score: 300,
      players: 2,
    });
  });

  /*
   * `played` and `rank` answer different questions. A round started and walked
   * out of spends the attempt and earns no rank — and a tile reading that as
   * "not played yet" would invite a player to start one the server refuses.
   */
  it('knows an abandoned round spent the attempt and earned no rank', async () => {
    await makeDay();
    await addPlayer('ada');
    await played('ada', null);

    expect(await readDailyTile({ db: store.db }, 'ada', AT)).toMatchObject({
      played: true,
      rank: null,
      players: 0,
    });
  });

  it('counts nothing from another day', async () => {
    await makeDay();
    await addPlayer('ada');
    await played('ada', 500);

    expect((await readDailyTile({ db: store.db }, 'ada', AT + 86_400_000)).players).toBe(
      0,
    );
  });
});
