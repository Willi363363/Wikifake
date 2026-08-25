// The reads and writes a round in progress is allowed to make.
//
// Two things are being locked here. The narrow reads of the solution really are
// narrow — a hint request loads one position, a scan loads indices and no prose
// — and the billing guarantees of C1.4 hold in the schema rather than only in
// the ledger that sits above it.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  openTestDatabase,
  rejectionCode,
  SQLSTATE,
  testDatabaseUrl,
  type TestDatabase,
} from '../testing/database.js';
import { game, gamePosition, participant, user } from '../schema/index.js';
import {
  recordHintPurchase,
  recordScan,
  recordSubmission,
  selectFalsifiedIndices,
  selectHintFor,
  selectParticipantFor,
  selectRoundStatus,
  selectScannedParagraphs,
} from './session.js';
import { selectHintPurchases } from './audit.js';
import { selectAnswers, selectGameInProgress, selectLeaderboard } from './game.js';

const url = testDatabaseUrl();

const TRUTH = 'TRUTHMARKER-vingt-arrondissements';
const HINT = 'HINTMARKER-comptez';
const ORIGINAL = 'ORIGINALMARKER-la-phrase-intacte';

describe.skipIf(url === null)('a round in progress', () => {
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

  async function seedRound(): Promise<{
    gameId: string;
    adaId: string;
    bobParticipantId: string;
  }> {
    const { db } = database;

    await db.insert(user).values([
      { id: 'ada', name: 'Ada', email: 'ada@example.test', emailVerified: false },
      { id: 'bob', name: 'Bob', email: 'bob@example.test', emailVerified: false },
    ]);

    const [round] = await db
      .insert(game)
      .values({
        mode: 'multiplayer',
        topic: 'Paris',
        sourceUrl: 'https://fr.wikipedia.org/wiki/Paris',
        paragraphs: ['un', 'deux', 'trois', 'quatre', 'cinq', 'six'],
        totalFakes: 3,
        timeLimit: 300,
      })
      .returning({ id: game.id });
    const gameId = round?.id as string;

    await db.insert(gamePosition).values([
      {
        gameId,
        paragraphIndex: 2,
        falseInfoNumber: 1,
        falseStatement: 'La ville compte deux arrondissements.',
        originalText: `${ORIGINAL}-1`,
        explanation: `${TRUTH}-1`,
        hint: `${HINT}-1`,
      },
      {
        gameId,
        paragraphIndex: 4,
        falseInfoNumber: 2,
        falseStatement: 'La tour Eiffel date de 1989.',
        originalText: `${ORIGINAL}-2`,
        explanation: `${TRUTH}-2`,
        hint: `${HINT}-2`,
      },
      {
        gameId,
        paragraphIndex: 6,
        falseInfoNumber: 3,
        falseStatement: 'La Seine se jette dans la Méditerranée.',
        originalText: `${ORIGINAL}-3`,
        explanation: `${TRUTH}-3`,
        hint: `${HINT}-3`,
      },
    ]);

    const players = await database.db
      .insert(participant)
      .values([
        { gameId, userId: 'ada', colour: '#e63946' },
        { gameId, userId: 'bob', colour: '#f4a261' },
      ])
      .returning({ id: participant.id, userId: participant.userId });

    const adaId = players.find((row) => row.userId === 'ada')?.id as string;
    const bobParticipantId = players.find((row) => row.userId === 'bob')?.id as string;
    return { gameId, adaId, bobParticipantId };
  }

  describe('the narrow reads of the solution', () => {
    // The point of these two queries. `selectSolution` exists for the debrief and
    // says so; a round in progress reads the least it can get away with, so a
    // handler cannot spill more than the one hint it was asked for.
    it('asks for one position, not for the solution', async () => {
      const { gameId } = await seedRound();

      const { sql } = selectHintFor(database.db, gameId, 2).toSQL();
      expect(sql).toContain('false_info_number');
      expect(sql).not.toContain('original_text');

      const rows = await selectHintFor(database.db, gameId, 2);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ falseInfoNumber: 2, paragraphIndex: 4 });
      expect(JSON.stringify(rows)).toContain(`${TRUTH}-2`);
      // And nothing about the other two.
      expect(JSON.stringify(rows)).not.toContain(`${TRUTH}-1`);
      expect(JSON.stringify(rows)).not.toContain(`${HINT}-3`);
    });

    it('asks the scanner query for indices and no prose at all', async () => {
      const { gameId } = await seedRound();

      const { sql } = selectFalsifiedIndices(database.db, gameId).toSQL();
      expect(sql).not.toContain('explanation');
      expect(sql).not.toContain('hint');
      expect(sql).not.toContain('original_text');
      expect(sql).not.toContain('false_statement');

      const rows = await selectFalsifiedIndices(database.db, gameId);
      expect(rows.map((row) => row.paragraphIndex)).toEqual([2, 4, 6]);
      expect(JSON.stringify(rows)).not.toContain('MARKER');
    });

    it('says nothing about a number the round does not have', async () => {
      const { gameId } = await seedRound();
      expect(await selectHintFor(database.db, gameId, 9)).toEqual([]);
    });
  });

  describe('who is asking', () => {
    it('finds the row this account plays as, and only that one', async () => {
      const { gameId, adaId } = await seedRound();

      const [found] = await selectParticipantFor(database.db, gameId, 'ada');
      expect(found?.id).toBe(adaId);
      expect(found?.submittedAt).toBeNull();
    });

    // The authorisation question, asked the way it will be asked in a handler: a
    // session handle is the game's identifier and is not a secret, so what
    // decides is whether the caller has a row in that game.
    it('finds nothing for someone who is not in the game', async () => {
      const { gameId } = await seedRound();
      expect(await selectParticipantFor(database.db, gameId, 'nobody')).toEqual([]);
    });

    it('reports whether the round is still open', async () => {
      const { gameId } = await seedRound();

      const [open] = await selectRoundStatus(database.db, gameId);
      expect(open?.timeLimit).toBe(300);
      expect(open?.endedAt).toBeNull();
    });
  });

  describe('C1.4 — billing a hint', () => {
    it('records what was charged, and refuses the same level twice', async () => {
      const { adaId } = await seedRound();

      await recordHintPurchase(database.db, {
        participantId: adaId,
        falseInfoNumber: 1,
        level: 1,
        charged: 50,
      });
      await recordHintPurchase(database.db, {
        participantId: adaId,
        falseInfoNumber: 1,
        level: 2,
        charged: 150,
      });

      // The guarantee lives in the constraint, not in the ledger above it: a
      // second row for a level already billed does not land, and says so. That
      // is the honest answer to a double-click — the player owns the level and
      // must be served it, once.
      expect(
        await recordHintPurchase(database.db, {
          participantId: adaId,
          falseInfoNumber: 1,
          level: 2,
          charged: 150,
        }),
      ).toBe(false);

      const purchases = await selectHintPurchases(database.db, adaId);
      expect(purchases.map((row) => row.level)).toEqual([1, 2]);
      expect(purchases.reduce((total, row) => total + row.charged, 0)).toBe(200);
    });

    it('refuses a purchase that cost nothing', async () => {
      const { adaId } = await seedRound();

      // A request granting a level already held is not a purchase. Writing it
      // would put a free row in the ledger's audit trail.
      expect(
        await rejectionCode(
          recordHintPurchase(database.db, {
            participantId: adaId,
            falseInfoNumber: 1,
            level: 1,
            charged: 0,
          }),
        ),
      ).toBe(SQLSTATE.checkViolation);
    });
  });

  describe('C1.6 — what the scanner has already designated', () => {
    it('remembers each designation, in order, per player', async () => {
      const { gameId, adaId, bobParticipantId } = await seedRound();

      expect(
        await recordScan(database.db, { gameId, casterId: adaId, paragraphIndex: 2 }),
      ).toBe(true);
      await recordScan(database.db, { gameId, casterId: adaId, paragraphIndex: 4 });
      await recordScan(database.db, {
        gameId,
        casterId: bobParticipantId,
        paragraphIndex: 6,
      });

      expect(
        (await selectScannedParagraphs(database.db, adaId)).map(
          (row) => row.paragraphIndex,
        ),
      ).toEqual([2, 4]);
      // Per player: what Ada was shown tells Bob nothing.
      expect(
        (await selectScannedParagraphs(database.db, bobParticipantId)).map(
          (row) => row.paragraphIndex,
        ),
      ).toEqual([6]);
    });

    // C1.6 — "remembered per player" as a constraint rather than as care taken
    // in a handler. Two requests racing on the same paragraph produce one row.
    it('refuses to designate the same paragraph to the same player twice', async () => {
      const { gameId, adaId, bobParticipantId } = await seedRound();

      expect(
        await recordScan(database.db, { gameId, casterId: adaId, paragraphIndex: 2 }),
      ).toBe(true);
      expect(
        await recordScan(database.db, { gameId, casterId: adaId, paragraphIndex: 2 }),
      ).toBe(false);

      // Another player is another record: Bob has not been shown it.
      expect(
        await recordScan(database.db, {
          gameId,
          casterId: bobParticipantId,
          paragraphIndex: 2,
        }),
      ).toBe(true);

      expect(await selectScannedParagraphs(database.db, adaId)).toHaveLength(1);
    });

    it('refuses a paragraph index that is not 1-based', async () => {
      const { gameId, adaId } = await seedRound();
      expect(
        await rejectionCode(
          recordScan(database.db, { gameId, casterId: adaId, paragraphIndex: 0 }),
        ),
      ).toBe(SQLSTATE.checkViolation);
    });
  });

  describe('settling the round', () => {
    const GRADED = {
      score: 420,
      truePositives: 3,
      falsePositives: 1,
      hintsUsed: 1,
      hintPenalty: 50,
      scoreStolen: 0,
      timeBonus: 100,
    };

    it('writes the breakdown, the marks and the end of the game at once', async () => {
      const { gameId, adaId } = await seedRound();
      const at = new Date('2026-08-25T10:00:00.000Z');

      expect(
        await recordSubmission(database.db, {
          gameId,
          participantId: adaId,
          marked: [2, 4, 6, 5],
          at,
          ...GRADED,
        }),
      ).toBe(true);

      const [standing] = (await selectLeaderboard(database.db, gameId)).filter(
        (row) => row.id === adaId,
      );
      expect(standing).toMatchObject(GRADED);

      expect(
        (await selectAnswers(database.db, adaId)).map((row) => row.paragraphIndex),
      ).toEqual([2, 4, 5, 6]);

      const [round] = await selectGameInProgress(database.db, gameId);
      expect(round?.endedAt).toEqual(at);
    });

    // D11 — one row per paragraph, however many times it was sent. The unique
    // constraint would refuse the second, and refusing it would abort the whole
    // submission over a repeat the player is allowed to make.
    it('writes one mark per paragraph, however often it was marked', async () => {
      const { gameId, adaId } = await seedRound();

      await recordSubmission(database.db, {
        gameId,
        participantId: adaId,
        marked: [2, 2, 2, 4],
        at: new Date(),
        ...GRADED,
      });

      expect(
        (await selectAnswers(database.db, adaId)).map((row) => row.paragraphIndex),
      ).toEqual([2, 4]);
    });

    // The conditional update is the guarantee: a second submission does not
    // regrade. Reported rather than raised, because the caller has a correct
    // answer to give — the grading that landed.
    it('grades once, and says so the second time', async () => {
      const { gameId, adaId } = await seedRound();

      expect(
        await recordSubmission(database.db, {
          gameId,
          participantId: adaId,
          marked: [2],
          at: new Date(),
          ...GRADED,
        }),
      ).toBe(true);

      expect(
        await recordSubmission(database.db, {
          gameId,
          participantId: adaId,
          marked: [4],
          at: new Date(),
          ...GRADED,
          score: 1,
        }),
      ).toBe(false);

      const [standing] = (await selectLeaderboard(database.db, gameId)).filter(
        (row) => row.id === adaId,
      );
      expect(standing?.score).toBe(GRADED.score);
      expect(
        (await selectAnswers(database.db, adaId)).map((row) => row.paragraphIndex),
      ).toEqual([2]);
    });

    it('leaves one player’s submission alone when another submits', async () => {
      const { gameId, adaId, bobParticipantId } = await seedRound();

      await recordSubmission(database.db, {
        gameId,
        participantId: adaId,
        marked: [2],
        at: new Date(),
        ...GRADED,
      });
      expect(
        await recordSubmission(database.db, {
          gameId,
          participantId: bobParticipantId,
          marked: [4],
          at: new Date(),
          ...GRADED,
          score: 300,
        }),
      ).toBe(true);

      const standings = await selectLeaderboard(database.db, gameId);
      expect(
        standings.map((row) => row.score).sort((a, b) => (a ?? 0) - (b ?? 0)),
      ).toEqual([300, 420]);
    });
  });
});
