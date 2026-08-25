// `createGame` writes a round, or writes nothing.
//
// The interesting assertions here are the ones about failure. A round is three
// tables, and the moment the response leaves the handler a player is reading the
// article: a game whose positions did not land is a round that cannot be graded,
// and the player finds out at the end.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import {
  openTestDatabase,
  testDatabaseUrl,
  type TestDatabase,
} from '../testing/database.js';
import { game, gamePosition, participant, user } from '../schema/index.js';
import { createGame, type NewGame } from './start.js';
import { selectGameInProgress, selectSolution } from './game.js';

const url = testDatabaseUrl();

const POSITIONS = [
  {
    paragraphIndex: 2,
    falseInfoNumber: 1,
    falseStatement: 'La ville compte deux arrondissements.',
    originalText: 'La ville compte vingt arrondissements.',
    explanation: 'Paris en compte vingt.',
    hint: 'Vérifiez ce nombre.',
  },
  {
    paragraphIndex: 4,
    falseInfoNumber: 2,
    falseStatement: 'La tour Eiffel date de 1989.',
    originalText: 'La tour Eiffel date de 1889.',
    explanation: 'Elle a été achevée en 1889.',
    hint: 'Vérifiez cette date.',
  },
] as const;

const ROUND: NewGame = {
  mode: 'solo',
  topic: 'Paris',
  sourceUrl: 'https://fr.wikipedia.org/wiki/Paris',
  paragraphs: ['un', 'deux', 'trois', 'quatre'],
  timeLimit: 300,
  fromCache: false,
  solution: POSITIONS,
  players: [{ guestName: 'Élise', colour: '#e63946' }],
};

describe.skipIf(url === null)('createGame', () => {
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

  it('writes the game, its solution and its participants at once', async () => {
    const { db } = database;
    const started = await createGame(db, ROUND);

    const [round] = await selectGameInProgress(db, started.gameId);
    expect(round?.topic).toBe('Paris');
    expect(round?.mode).toBe('solo');
    expect(round?.timeLimit).toBe(300);
    expect(round?.paragraphs).toEqual(['un', 'deux', 'trois', 'quatre']);

    const solution = await selectSolution(db, started.gameId);
    expect(solution.map((position) => position.paragraphIndex)).toEqual([2, 4]);
    expect(solution.map((position) => position.originalText)).toEqual([
      'La ville compte vingt arrondissements.',
      'La tour Eiffel date de 1889.',
    ]);

    expect(started.participantIds).toHaveLength(1);
    const [player] = await db
      .select({ name: participant.guestName, colour: participant.colour })
      .from(participant)
      .where(eq(participant.gameId, started.gameId));
    expect(player).toEqual({ name: 'Élise', colour: '#e63946' });
  });

  // C1.1 — the count is the only thing a player is told about the solution, so
  // it is read off the solution rather than accepted from a caller. A caller
  // free to pass its own could announce three fakes in a round that has four,
  // and no constraint in the schema would notice.
  it('counts the fakes itself', async () => {
    const started = await createGame(database.db, ROUND);
    const [round] = await selectGameInProgress(database.db, started.gameId);
    expect(round?.totalFakes).toBe(POSITIONS.length);
  });

  it('records whether the article was generated or reused', async () => {
    const { db } = database;
    const generated = await createGame(db, ROUND);
    const reused = await createGame(db, { ...ROUND, fromCache: true });

    const rows = await db
      .select({ id: game.id, fromCache: game.fromCache })
      .from(game)
      .orderBy(game.startedAt);
    expect(new Map(rows.map((row) => [row.id, row.fromCache]))).toEqual(
      new Map([
        [generated.gameId, false],
        [reused.gameId, true],
      ]),
    );
  });

  it('attaches the round to an account when there is one', async () => {
    const { db } = database;
    await db.insert(user).values({
      id: 'account-1',
      name: 'Élise',
      email: 'elise@example.test',
      emailVerified: false,
    });

    const started = await createGame(db, {
      ...ROUND,
      players: [{ userId: 'account-1', guestName: 'Élise', colour: '#e63946' }],
    });

    const [player] = await db
      .select({ userId: participant.userId })
      .from(participant)
      .where(eq(participant.gameId, started.gameId));
    expect(player?.userId).toBe('account-1');
  });

  // The transaction, checked where it matters: a solution the schema refuses —
  // two falsifications in the same paragraph, which C3.3 forbids and a unique
  // constraint enforces — must take the game down with it. A `game` row left
  // behind is a round a player can be handed and never graded on.
  it('leaves nothing behind when the solution is refused', async () => {
    const { db } = database;
    const clash = [
      POSITIONS[0],
      { ...POSITIONS[1], paragraphIndex: POSITIONS[0].paragraphIndex },
    ];

    await expect(createGame(db, { ...ROUND, solution: clash })).rejects.toThrow();

    expect(await db.select({ id: game.id }).from(game)).toEqual([]);
    expect(await db.select({ id: gamePosition.id }).from(gamePosition)).toEqual([]);
    expect(await db.select({ id: participant.id }).from(participant)).toEqual([]);
  });

  it('leaves nothing behind when the participant is refused', async () => {
    const { db } = database;

    // Neither an identity nor a nickname: `participant_account_or_guest` refuses
    // it, and the two tables already written have to go with it.
    await expect(
      createGame(db, { ...ROUND, players: [{ colour: '#e63946' }] }),
    ).rejects.toThrow();

    expect(await db.select({ id: game.id }).from(game)).toEqual([]);
    expect(await db.select({ id: gamePosition.id }).from(gamePosition)).toEqual([]);
  });

  it('refuses a round nobody can play', async () => {
    const { db } = database;
    await expect(createGame(db, { ...ROUND, solution: [] })).rejects.toThrow(
      /no falsification/,
    );
    await expect(createGame(db, { ...ROUND, players: [] })).rejects.toThrow(
      /nobody in it/,
    );
    expect(await db.select({ id: game.id }).from(game)).toEqual([]);
  });
});
