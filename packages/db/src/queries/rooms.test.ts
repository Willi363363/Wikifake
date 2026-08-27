// A room's row, and what forgetting it costs.
//
// The interesting assertion is the last one. `game.room_code` is declared
// `onDelete: 'set null'`, so reaping a room is not a decision confined to the
// `room` table: it reaches every round played in it. That is the intended
// behaviour and it is worth pinning, because the alternative — a cascade — would
// delete the games with the room, and nobody would notice until the history was
// gone.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import {
  openTestDatabase,
  testDatabaseUrl,
  type TestDatabase,
} from '../testing/database.js';
import { game } from '../schema/index.js';
import { createGame, type NewGame } from './start.js';
import { deleteRoom, insertRoom, selectRoom } from './rooms.js';

const url = testDatabaseUrl();

const ROUND: NewGame = {
  mode: 'multiplayer',
  roomCode: 'A1B2C3',
  topic: 'Paris',
  sourceUrl: 'https://fr.wikipedia.org/wiki/Paris',
  paragraphs: ['un', 'deux'],
  timeLimit: 300,
  fromCache: false,
  solution: [
    {
      paragraphIndex: 1,
      falseInfoNumber: 1,
      falseStatement: 'La ville compte deux arrondissements.',
      originalText: 'La ville compte vingt arrondissements.',
      explanation: 'Paris en compte vingt.',
      hint: 'Vérifiez ce nombre.',
    },
  ],
  players: [{ guestName: 'Élise', colour: '#e63946' }],
};

describe.skipIf(url === null)('deleteRoom', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await openTestDatabase(url as string);
  });
  afterAll(async () => {
    await database.close();
  });
  beforeEach(async () => {
    await database.truncate();
  });

  it('forgets the room', async () => {
    const { db } = database;
    await insertRoom(db, { code: 'A1B2C3', timeLimit: 300 });

    expect(await deleteRoom(db, 'A1B2C3')).toBe(true);
    expect(await selectRoom(db, 'A1B2C3')).toHaveLength(0);
  });

  // Says whether it landed, so the caller can tell "closed now" from "closed by
  // somebody else a moment ago" — two instances may both decide a room is over.
  it('reports a room that was not there', async () => {
    expect(await deleteRoom(database.db, 'NOSUCH')).toBe(false);
  });

  it('leaves the other rooms alone', async () => {
    const { db } = database;
    await insertRoom(db, { code: 'A1B2C3', timeLimit: 300 });
    await insertRoom(db, { code: 'D4E5F6', timeLimit: 300 });

    await deleteRoom(db, 'A1B2C3');

    expect(await selectRoom(db, 'D4E5F6')).toHaveLength(1);
  });

  // The consequence, stated. A round survives the room it was played in and
  // keeps everything that makes it a round; what it loses is a code that can be
  // drawn again tomorrow for somebody else's room.
  it('keeps the games played in it, without their room code', async () => {
    const { db } = database;
    await insertRoom(db, { code: 'A1B2C3', timeLimit: 300 });
    const started = await createGame(db, ROUND);

    await deleteRoom(db, 'A1B2C3');

    const [played] = await db
      .select({ id: game.id, topic: game.topic, roomCode: game.roomCode })
      .from(game)
      .where(eq(game.id, started.gameId));
    expect(played).toEqual({ id: started.gameId, topic: 'Paris', roomCode: null });
  });
});
