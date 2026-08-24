import { ITEM_IDS } from '@wikifake/protocol';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  openTestDatabase,
  rejectionCode,
  SQLSTATE,
  testDatabaseUrl,
  type TestDatabase,
} from '../testing/database.js';
import {
  flagReport,
  game,
  hintPurchase,
  itemIdEnum,
  itemUse,
  participant,
} from '../schema/index.js';
import {
  isMonotonic,
  selectHintPurchases,
  selectItemUses,
  selectReportsToReview,
} from './audit.js';

const url = testDatabaseUrl();

// C2.1's numbers, written out rather than imported: `db` must not depend on
// `domain`. Data does not depend on rules — that arrow points the other way, and
// these are example amounts in a test about auditing, not about the scale.
const HINT_COST = 50;
const REVEAL_COST = 200;

describe.skipIf(url === null)('the audit tables', () => {
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

  async function seed(): Promise<{ gameId: string; adaId: string; bobId: string }> {
    const { db } = database;
    const [inserted] = await db
      .insert(game)
      .values({
        mode: 'multiplayer',
        topic: 'Paris',
        sourceUrl: 'https://fr.wikipedia.org/wiki/Paris',
        paragraphs: ['un', 'deux'],
        totalFakes: 2,
        timeLimit: 300,
      })
      .returning({ id: game.id });
    const gameId = inserted?.id as string;

    const players = await db
      .insert(participant)
      .values([
        { gameId, guestName: 'ada', colour: '#e63946' },
        { gameId, guestName: 'bob', colour: '#2a9d8f' },
      ])
      .returning({ id: participant.id, guestName: participant.guestName });

    return {
      gameId,
      adaId: players.find((row) => row.guestName === 'ada')?.id as string,
      bobId: players.find((row) => row.guestName === 'bob')?.id as string,
    };
  }

  describe('C1.4 — hint purchases are auditable', () => {
    it('reconstructs a purchase sequence in timestamp order', async () => {
      const { adaId } = await seed();
      const { db } = database;

      // A nudge on one falsification, then a reveal on it, then a nudge on
      // another — the ordinary shape of a round.
      await db.insert(hintPurchase).values([
        {
          participantId: adaId,
          falseInfoNumber: 1,
          level: 1,
          charged: HINT_COST,
          purchasedAt: new Date('2026-01-01T12:00:00Z'),
        },
        {
          participantId: adaId,
          falseInfoNumber: 1,
          level: 2,
          charged: REVEAL_COST - HINT_COST,
          purchasedAt: new Date('2026-01-01T12:01:00Z'),
        },
        {
          participantId: adaId,
          falseInfoNumber: 2,
          level: 1,
          charged: HINT_COST,
          purchasedAt: new Date('2026-01-01T12:02:00Z'),
        },
      ]);

      const purchases = await selectHintPurchases(db, adaId);
      expect(purchases.map((row) => [row.falseInfoNumber, row.level])).toEqual([
        [1, 1],
        [1, 2],
        [2, 1],
      ]);
      // C2.2 — the charges add up to the non-cumulative total, not to 250.
      expect(purchases.reduce((total, row) => total + row.charged, 0)).toBe(
        REVEAL_COST + HINT_COST,
      );
    });

    // The constraint is the guarantee, not a record of it: whatever an
    // in-memory ledger believes, the same level cannot be charged twice.
    it('refuses to charge the same level twice', async () => {
      const { adaId } = await seed();
      const purchase = {
        participantId: adaId,
        falseInfoNumber: 1,
        level: 2,
        charged: REVEAL_COST,
      };
      await database.db.insert(hintPurchase).values(purchase);
      expect(await rejectionCode(database.db.insert(hintPurchase).values(purchase))).toBe(
        SQLSTATE.uniqueViolation,
      );
    });

    it('refuses a purchase that charged nothing: that is not a purchase', async () => {
      const { adaId } = await seed();
      const code = await rejectionCode(
        database.db
          .insert(hintPurchase)
          .values({ participantId: adaId, falseInfoNumber: 1, level: 1, charged: 0 }),
      );
      expect(code).toBe(SQLSTATE.checkViolation);
    });

    it('refuses a level that is neither 1 nor 2', async () => {
      const { adaId } = await seed();
      const code = await rejectionCode(
        database.db
          .insert(hintPurchase)
          .values({ participantId: adaId, falseInfoNumber: 1, level: 3, charged: 50 }),
      );
      expect(code).toBe(SQLSTATE.checkViolation);
    });

    it('reads monotonicity off the record', async () => {
      expect(
        isMonotonic([
          { falseInfoNumber: 1, level: 1 },
          { falseInfoNumber: 1, level: 2 },
          { falseInfoNumber: 2, level: 1 },
        ]),
      ).toBe(true);
      // Going back down would mean a reveal was followed by a billed nudge.
      expect(
        isMonotonic([
          { falseInfoNumber: 1, level: 2 },
          { falseInfoNumber: 1, level: 1 },
        ]),
      ).toBe(false);
      expect(
        isMonotonic([
          { falseInfoNumber: 1, level: 1 },
          { falseInfoNumber: 1, level: 1 },
        ]),
      ).toBe(false);
      expect(isMonotonic([])).toBe(true);
    });
  });

  describe('item uses', () => {
    it('records who sabotaged whom, oldest first', async () => {
      const { gameId, adaId, bobId } = await seed();
      await database.db.insert(itemUse).values([
        {
          gameId,
          casterId: bobId,
          targetId: adaId,
          itemId: 'SCORE_STEAL',
          usedAt: new Date('2026-01-01T12:01:00Z'),
        },
        {
          gameId,
          casterId: adaId,
          targetId: bobId,
          itemId: 'BLUR',
          usedAt: new Date('2026-01-01T12:00:00Z'),
        },
      ]);

      expect(
        (await selectItemUses(database.db, gameId)).map((row) => row.itemId),
      ).toEqual(['BLUR', 'SCORE_STEAL']);
    });

    it('records a self-cast item with no target', async () => {
      const { gameId, adaId } = await seed();
      await database.db
        .insert(itemUse)
        .values({ gameId, casterId: adaId, itemId: 'SCANNER' });
      const [use] = await selectItemUses(database.db, gameId);
      expect(use).toMatchObject({ itemId: 'SCANNER', targetId: null });
    });

    // D6, closed a second time: `domain` refuses it, and here it cannot even be
    // recorded.
    it('refuses a caster targeting themselves', async () => {
      const { gameId, adaId } = await seed();
      const code = await rejectionCode(
        database.db
          .insert(itemUse)
          .values({ gameId, casterId: adaId, targetId: adaId, itemId: 'BLUR' }),
      );
      expect(code).toBe(SQLSTATE.checkViolation);
    });

    // D8 — the enum is built from the contract, so this asserts they agree
    // rather than that somebody copied the list correctly.
    it('accepts exactly the item identifiers the protocol declares', () => {
      expect(itemIdEnum.enumValues).toEqual([...ITEM_IDS]);
    });

    it('refuses an item the protocol does not know', async () => {
      const { gameId, adaId, bobId } = await seed();
      const code = await rejectionCode(
        database.db.insert(itemUse).values({
          gameId,
          casterId: adaId,
          targetId: bobId,
          itemId: 'MIND_CONTROL' as 'BLUR',
        }),
      );
      expect(code).not.toBe(null);
    });
  });

  describe('flag reports', () => {
    const report = {
      articleTitle: 'Paris',
      flaggedClaim: 'Paris compte deux arrondissements.',
      proposedCorrection: 'Paris compte vingt arrondissements.',
      sources: ['https://fr.wikipedia.org/wiki/Paris'],
      status: 'pending_human_review' as const,
      verdict: 'likely_valid' as const,
      confidence: 90,
      reasoning: 'Le contexte confirme la correction.',
      sourcesFound: ['vingt arrondissements'],
      recommendation: 'approve_for_review' as const,
    };

    it('stores a report with its verdict and reads it back', async () => {
      const { gameId } = await seed();
      await database.db.insert(flagReport).values({ ...report, gameId });

      const [queued] = await selectReportsToReview(database.db);
      expect(queued).toMatchObject({
        articleTitle: 'Paris',
        verdict: 'likely_valid',
        confidence: 90,
      });
    });

    it('keeps the sources as lists, not strings', async () => {
      await database.db.insert(flagReport).values(report);
      const [row] = await database.db.select().from(flagReport);
      expect(row?.sources).toEqual(['https://fr.wikipedia.org/wiki/Paris']);
      expect(row?.sourcesFound).toEqual(['vingt arrondissements']);
    });

    it('only queues what a human has to look at', async () => {
      await database.db.insert(flagReport).values([
        report,
        {
          ...report,
          status: 'rejected_by_ai',
          recommendation: 'reject',
          verdict: 'unsupported',
        },
      ]);
      expect(await selectReportsToReview(database.db)).toHaveLength(1);
    });

    it('refuses a confidence outside 0-100', async () => {
      const code = await rejectionCode(
        database.db.insert(flagReport).values({ ...report, confidence: 120 }),
      );
      expect(code).toBe(SQLSTATE.checkViolation);
    });

    // A report survives the game it came from: the whole point is that the
    // correction outlives the round, unlike `complaints.jsonl` on an ephemeral
    // disk.
    it('survives the game it was filed from', async () => {
      const { gameId } = await seed();
      await database.db.insert(flagReport).values({ ...report, gameId });
      await database.db.delete(game);

      const [row] = await database.db.select().from(flagReport);
      expect(row?.gameId).toBe(null);
      expect(row?.articleTitle).toBe('Paris');
    });
  });
});
