// The step's two criteria: a complete game inserts and reads back typed, and the
// in-progress reads never touch `game_position`.
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  openTestDatabase,
  rejectionCode,
  SQLSTATE,
  testDatabaseUrl,
  type TestDatabase,
} from '../testing/database.js';
import { answer, game, gamePosition, participant, room, user } from '../schema/index.js';
import {
  IN_PROGRESS_QUERIES,
  selectAnswers,
  selectGameInProgress,
  selectLeaderboard,
  selectParticipantsInProgress,
  selectSolution,
} from './game.js';

const url = testDatabaseUrl();

/** Markers, so "no truth text appears" is a search for something specific. */
const TRUTH = 'TRUTHMARKER-twenty-arrondissements';
const HINT = 'HINTMARKER-check-the-number';
const ORIGINAL = 'ORIGINALMARKER-the-unfalsified-sentence';

describe.skipIf(url === null)('a complete game', () => {
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

  /** room → game → positions → participants → answers, as the step asks. */
  async function seedGame(): Promise<{ gameId: string; adaId: string }> {
    const { db } = database;

    await db.insert(room).values({ code: 'A1B2C3', hostName: 'ada', timeLimit: 300 });
    const [inserted] = await db
      .insert(game)
      .values({
        roomCode: 'A1B2C3',
        mode: 'multiplayer',
        topic: 'Paris',
        sourceUrl: 'https://fr.wikipedia.org/wiki/Paris',
        paragraphs: ['Paris est la capitale.', 'La ville compte deux arrondissements.'],
        totalFakes: 1,
        timeLimit: 300,
      })
      .returning({ id: game.id });
    const gameId = inserted?.id as string;

    await db.insert(gamePosition).values({
      gameId,
      paragraphIndex: 2,
      falseInfoNumber: 1,
      falseStatement: 'La ville compte deux arrondissements.',
      originalText: ORIGINAL,
      explanation: TRUTH,
      hint: HINT,
    });

    await db
      .insert(user)
      .values({ id: 'user_ada', name: 'Ada', email: 'ada@example.org' });
    const [ada] = await db
      .insert(participant)
      .values({
        gameId,
        userId: 'user_ada',
        colour: '#e63946',
        submittedAt: new Date('2026-01-01T12:00:00Z'),
        score: 300,
        truePositives: 1,
        falsePositives: 0,
        hintsUsed: 0,
        hintPenalty: 0,
        scoreStolen: 0,
        timeBonus: 150,
      })
      .returning({ id: participant.id });
    const adaId = ada?.id as string;

    await db.insert(participant).values({ gameId, guestName: 'bob', colour: '#2a9d8f' });

    await db.insert(answer).values([
      { participantId: adaId, paragraphIndex: 2 },
      { participantId: adaId, paragraphIndex: 4 },
    ]);

    return { gameId, adaId };
  }

  it('inserts and reads back the whole chain, typed', async () => {
    const { gameId, adaId } = await seedGame();
    const { db } = database;

    const [inProgress] = await selectGameInProgress(db, gameId);
    expect(inProgress).toMatchObject({
      mode: 'multiplayer',
      topic: 'Paris',
      totalFakes: 1,
      roomCode: 'A1B2C3',
    });
    expect(inProgress?.paragraphs).toEqual([
      'Paris est la capitale.',
      'La ville compte deux arrondissements.',
    ]);

    const players = await selectParticipantsInProgress(db, gameId);
    expect(players).toHaveLength(2);

    const solution = await selectSolution(db, gameId);
    expect(solution).toEqual([
      {
        paragraphIndex: 2,
        falseInfoNumber: 1,
        falseStatement: 'La ville compte deux arrondissements.',
        originalText: ORIGINAL,
        explanation: TRUTH,
        hint: HINT,
      },
    ]);

    expect(await selectAnswers(db, adaId)).toEqual([
      { paragraphIndex: 2 },
      { paragraphIndex: 4 },
    ]);

    const leaderboard = await selectLeaderboard(db, gameId);
    expect(leaderboard.find((row) => row.userId === 'user_ada')?.score).toBe(300);
    // A player who never submitted has no score, rather than a zero nobody earned.
    expect(leaderboard.find((row) => row.guestName === 'bob')?.score).toBe(null);
  });

  // C1.1 — the criterion, checked on the SQL the query will actually send.
  // Omitting a column is something a reviewer has to notice; not joining a table
  // is something a test can read.
  describe('the in-progress reads cannot reach the solution', () => {
    it.each(IN_PROGRESS_QUERIES.map((query) => [query.name, query] as const))(
      '%s does not mention game_position',
      (_name, query) => {
        const { sql } = query(database.db, 'some-game-id').toSQL();
        expect(sql).not.toContain('game_position');
        expect(sql).not.toContain('explanation');
        expect(sql).not.toContain('hint');
        expect(sql).not.toContain('original_text');
      },
    );

    it('serialises no truth text, no hint and no original text', async () => {
      const { gameId } = await seedGame();
      const { db } = database;

      const serialised = JSON.stringify([
        await selectGameInProgress(db, gameId),
        await selectParticipantsInProgress(db, gameId),
      ]);

      for (const forbidden of [TRUTH, HINT, ORIGINAL]) {
        expect(serialised, `"${forbidden}" reached an in-progress read`).not.toContain(
          forbidden,
        );
      }
      // And the article the player reads is still there: an assertion that
      // passes by returning nothing proves nothing.
      expect(serialised).toContain('La ville compte deux arrondissements.');
    });

    it('the in-progress reads are the only ones declared as such', () => {
      expect(IN_PROGRESS_QUERIES.map((query) => query.name)).toEqual([
        'selectGameInProgress',
        'selectParticipantsInProgress',
      ]);
    });
  });

  describe('what the schema refuses', () => {
    it('C3.3 — two falsifications on one paragraph', async () => {
      const { gameId } = await seedGame();
      const code = await rejectionCode(
        database.db.insert(gamePosition).values({
          gameId,
          paragraphIndex: 2,
          falseInfoNumber: 2,
          falseStatement: 'x',
          originalText: 'y',
          explanation: 'z',
          hint: 'w',
        }),
      );
      expect(code).toBe(SQLSTATE.uniqueViolation);
    });

    it('C3.3 — a repeated falsification number', async () => {
      const { gameId } = await seedGame();
      const code = await rejectionCode(
        database.db.insert(gamePosition).values({
          gameId,
          paragraphIndex: 5,
          falseInfoNumber: 1,
          falseStatement: 'x',
          originalText: 'y',
          explanation: 'z',
          hint: 'w',
        }),
      );
      expect(code).toBe(SQLSTATE.uniqueViolation);
    });

    it('C3.3 — a 0-based paragraph index', async () => {
      const { gameId } = await seedGame();
      const code = await rejectionCode(
        database.db.insert(gamePosition).values({
          gameId,
          paragraphIndex: 0,
          falseInfoNumber: 9,
          falseStatement: 'x',
          originalText: 'y',
          explanation: 'z',
          hint: 'w',
        }),
      );
      expect(code).toBe(SQLSTATE.checkViolation);
    });

    // D11, closed a second time: `domain` counts a duplicate once, and here it
    // cannot be written twice at all.
    it('D11 — the same paragraph marked twice', async () => {
      const { adaId } = await seedGame();
      const code = await rejectionCode(
        database.db.insert(answer).values({ participantId: adaId, paragraphIndex: 2 }),
      );
      expect(code).toBe(SQLSTATE.uniqueViolation);
    });

    it('a participant who is neither an account nor a guest', async () => {
      const { gameId } = await seedGame();
      const code = await rejectionCode(
        database.db.insert(participant).values({ gameId, colour: '#000000' }),
      );
      expect(code).toBe(SQLSTATE.checkViolation);
    });

    it('a participant who is both', async () => {
      const { gameId } = await seedGame();
      const code = await rejectionCode(
        database.db
          .insert(participant)
          .values({ gameId, userId: 'user_ada', guestName: 'ada', colour: '#000000' }),
      );
      expect(code).toBe(SQLSTATE.checkViolation);
    });

    it('a score with no submission behind it', async () => {
      const { gameId } = await seedGame();
      const code = await rejectionCode(
        database.db
          .insert(participant)
          .values({ gameId, guestName: 'cyd', colour: '#000000', score: 9_999 }),
      );
      expect(code).toBe(SQLSTATE.checkViolation);
    });

    it('a game with no falsification in it', async () => {
      const code = await rejectionCode(
        database.db.insert(game).values({
          mode: 'solo',
          topic: 'Paris',
          sourceUrl: 'https://fr.wikipedia.org/wiki/Paris',
          paragraphs: [],
          totalFakes: 0,
          timeLimit: 300,
        }),
      );
      expect(code).toBe(SQLSTATE.checkViolation);
    });
  });

  describe('what a deleted game takes with it', () => {
    it('its solution, its participants and their answers', async () => {
      const { gameId } = await seedGame();
      const { db } = database;

      await db.delete(game).where(eq(game.id, gameId));

      expect(await db.select().from(gamePosition)).toEqual([]);
      expect(await db.select().from(participant)).toEqual([]);
      expect(await db.select().from(answer)).toEqual([]);
    });

    // A game is history: losing the room must not lose the game that was played
    // in it.
    it('but a deleted room keeps the game', async () => {
      const { gameId } = await seedGame();
      const { db } = database;

      await db.delete(room).where(eq(room.code, 'A1B2C3'));

      const [survivor] = await selectGameInProgress(db, gameId);
      expect(survivor?.roomCode).toBe(null);
      expect(survivor?.topic).toBe('Paris');
    });
  });
});
