// 4.3's data half: what an account has played, and moving a guest's play onto it.
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { attachGuestRecords, HISTORY_QUERIES, selectGameHistory } from './history.js';
import { flagReport } from '../schema/audit.js';
import { game, participant } from '../schema/game.js';
import { user } from '../schema/auth.js';
import {
  openTestDatabase,
  rejectionCode,
  SQLSTATE,
  testDatabaseUrl,
} from '../testing/database.js';
import type { TestDatabase } from '../testing/database.js';

const url = testDatabaseUrl();

describe.skipIf(url === null)('a guest, and the account that comes after', () => {
  let store: TestDatabase;

  beforeAll(async () => {
    store = await openTestDatabase(url as string);
  });

  beforeEach(async () => {
    await store.truncate();
  });

  afterAll(async () => {
    await store.close();
  });

  // C1.1 and C1.2 — a history list and a debrief look alike, and one of them is
  // about games somebody else may still be playing. Checked on the SQL the query
  // will actually send, so it holds for rows that do not exist yet.
  describe('never mention the solution', () => {
    it.each(HISTORY_QUERIES.map((query) => [query.name, query] as const))(
      '%s',
      (_name, query) => {
        const { sql } = query(store.db, 'a-user-id').toSQL();
        expect(sql).not.toContain('game_position');
        expect(sql).not.toContain('explanation');
        expect(sql).not.toContain('hint');
        expect(sql).not.toContain('original_text');
      },
    );
  });

  const addUser = async (id: string, name: string, anonymous: boolean): Promise<void> => {
    await store.db.insert(user).values({
      id,
      name,
      email: `${id}@example.test`,
      isAnonymous: anonymous,
    });
  };

  const addGame = async (topic: string): Promise<string> => {
    const [row] = await store.db
      .insert(game)
      .values({
        mode: 'solo',
        topic,
        sourceUrl: `https://fr.wikipedia.org/wiki/${topic}`,
        paragraphs: ['un paragraphe'],
        totalFakes: 2,
        timeLimit: 300,
      })
      .returning({ id: game.id });
    if (row === undefined) throw new Error('no game');
    return row.id;
  };

  it('lets a participant carry both an identity and a chosen name', async () => {
    // The case phase 2's "exactly one" check forbade, and which is the normal one
    // for a guest: an anonymous row for identity, a nickname for this game.
    await addUser('guest-1', 'Anonymous', true);
    const gameId = await addGame('Chocolat');

    await store.db.insert(participant).values({
      gameId,
      userId: 'guest-1',
      guestName: 'Élise',
      colour: '#ff0000',
    });

    const [row] = await store.db.select().from(participant);
    expect(row?.userId).toBe('guest-1');
    expect(row?.guestName).toBe('Élise');
  });

  it('still refuses a participant that is neither', async () => {
    const gameId = await addGame('Chat');
    const code = await rejectionCode(
      store.db.insert(participant).values({ gameId, colour: '#00ff00' }),
    );
    expect(code).toBe(SQLSTATE.checkViolation);
  });

  it('moves the games a guest played onto the new account', async () => {
    await addUser('guest-1', 'Anonymous', true);
    await addUser('account-1', 'Élise Dupont', false);
    const first = await addGame('Chocolat');
    const second = await addGame('Chat');

    for (const gameId of [first, second]) {
      await store.db
        .insert(participant)
        .values({ gameId, userId: 'guest-1', guestName: 'Élise', colour: '#ff0000' });
    }

    expect(await selectGameHistory(store.db, 'account-1')).toEqual([]);

    const moved = await attachGuestRecords(store.db, 'guest-1', 'account-1');
    expect(moved.participants).toBe(2);

    const history = await selectGameHistory(store.db, 'account-1');
    expect(history.map((row) => row.topic).sort()).toEqual(['Chat', 'Chocolat']);
    // The name they played under survives the move: it is what the other players
    // saw, and rewriting it would rewrite their debrief too.
    expect(history.every((row) => row.playedAs === 'Élise')).toBe(true);
    expect(await selectGameHistory(store.db, 'guest-1')).toEqual([]);
  });

  it('takes their reports with them', async () => {
    await addUser('guest-1', 'Anonymous', true);
    await addUser('account-1', 'Élise Dupont', false);
    const gameId = await addGame('Chocolat');

    await store.db.insert(flagReport).values({
      gameId,
      reporterId: 'guest-1',
      articleTitle: 'Chocolat',
      flaggedClaim: 'le cacao vient du Brésil',
      proposedCorrection: 'le cacao vient d Amérique centrale',
      status: 'pending_human_review',
      verdict: 'uncertain',
      confidence: 40,
      reasoning: 'les sources se contredisent',
      recommendation: 'needs_more_info',
    });

    await attachGuestRecords(store.db, 'guest-1', 'account-1');

    const [report] = await store.db.select().from(flagReport);
    expect(report?.reporterId).toBe('account-1');
  });

  // The order the whole step rests on: the hook runs before the plugin deletes
  // the anonymous row, so after attaching, deleting it must take nothing with it.
  it('survives the anonymous row being deleted afterwards', async () => {
    await addUser('guest-1', 'Anonymous', true);
    await addUser('account-1', 'Élise Dupont', false);
    const gameId = await addGame('Chocolat');
    await store.db
      .insert(participant)
      .values({ gameId, userId: 'guest-1', guestName: 'Élise', colour: '#ff0000' });

    await attachGuestRecords(store.db, 'guest-1', 'account-1');
    await store.db.delete(user).where(eq(user.id, 'guest-1'));

    expect(await selectGameHistory(store.db, 'account-1')).toHaveLength(1);
  });

  // And what would happen without the attachment: `set null` leaves the row with
  // neither an identity nor — for an account player — a name. This is the
  // constraint failure that made the old "exactly one" check abort the delete.
  it('refuses to strand a participant that has no name either', async () => {
    await addUser('guest-1', 'Anonymous', true);
    const gameId = await addGame('Chocolat');
    await store.db
      .insert(participant)
      .values({ gameId, userId: 'guest-1', colour: '#ff0000' });

    const code = await rejectionCode(store.db.delete(user).where(eq(user.id, 'guest-1')));
    expect(code).toBe(SQLSTATE.checkViolation);
  });

  it('refuses to attach an account to itself', async () => {
    await expect(attachGuestRecords(store.db, 'account-1', 'account-1')).rejects.toThrow(
      /same user/,
    );
  });
});
