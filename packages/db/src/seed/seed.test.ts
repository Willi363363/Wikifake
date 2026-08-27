// 2.6's criteria: the seed fills a fresh database, replays without error, and
// the queries of 2.3 to 2.5 return something on it.
//
// "Replays without error" is the weak half of that. A seed can replay without
// error and still not be idempotent — mine did, printing "seeded" twice while
// quietly doubling three tables, because their primary keys defaulted to a
// random UUID and `onConflictDoNothing` had no conflict to find. So the test
// counts rows rather than trusting the exit code.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  answer,
  flagReport,
  game,
  gamePosition,
  hintPurchase,
  itemUse,
  llmCall,
  participant,
  profile,
  room,
  user,
} from '../schema/index.js';
import { isMonotonic, selectHintPurchases, selectItemUses } from '../queries/audit.js';
import {
  selectGameInProgress,
  selectLeaderboard,
  selectParticipantsInProgress,
  selectSolution,
} from '../queries/game.js';
import { readUsageTotals, usageReport } from '../queries/usage.js';
import {
  openTestDatabase,
  testDatabaseUrl,
  type TestDatabase,
} from '../testing/database.js';
import { SEED_GAME, SEED_PARTICIPANTS } from './data.js';
import { seed } from './seed.js';

const url = testDatabaseUrl();

/** Every seeded table, so "doubled on replay" cannot hide in one of them. */
const TABLES = [
  ['user', user],
  ['profile', profile],
  ['room', room],
  ['game', game],
  ['game_position', gamePosition],
  ['participant', participant],
  ['answer', answer],
  ['hint_purchase', hintPurchase],
  ['item_use', itemUse],
  ['llm_call', llmCall],
  ['flag_report', flagReport],
] as const;

describe.skipIf(url === null)('the development seed', () => {
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

  async function counts(): Promise<Record<string, number>> {
    const entries = await Promise.all(
      TABLES.map(async ([name, table]) => {
        const rows = await database.db.select().from(table);
        return [name, rows.length] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  it('fills a fresh database', async () => {
    await seed(database.db);
    const filled = await counts();

    for (const [name, count] of Object.entries(filled)) {
      expect(count, `${name} is empty`).toBeGreaterThan(0);
    }
  });

  it('replays without changing anything', async () => {
    await seed(database.db);
    const once = await counts();

    await seed(database.db);
    await seed(database.db);

    expect(await counts()).toEqual(once);
  });

  describe('the queries of 2.3 to 2.5 answer on it', () => {
    beforeEach(async () => {
      await seed(database.db);
    });

    it('2.3 — the game reads back, and the solution is separate', async () => {
      const [inProgress] = await selectGameInProgress(database.db, SEED_GAME.id);
      expect(inProgress?.topic).toBe('Paris');
      expect(inProgress?.totalFakes).toBe(2);

      expect(await selectParticipantsInProgress(database.db, SEED_GAME.id)).toHaveLength(
        2,
      );
      expect(await selectSolution(database.db, SEED_GAME.id)).toHaveLength(2);
    });

    it('2.3 — the in-progress read still carries no truth text', async () => {
      const serialised = JSON.stringify(
        await selectGameInProgress(database.db, SEED_GAME.id),
      );
      expect(serialised).not.toContain('vingt arrondissements');
      expect(serialised).not.toContain('1889');
    });

    // The seeded scores are C2.1 applied by hand; if the scale ever moves, this
    // is where the seed stops describing a real game.
    it('2.3 — the leaderboard matches the scale', async () => {
      const leaderboard = await selectLeaderboard(database.db, SEED_GAME.id);
      const ada = leaderboard.find((row) => row.userId === 'seed_user_ada');
      // 2×150 − 1×80 − 200 − 50 + 90 = 60
      expect(ada?.score).toBe(60);
      const guest = leaderboard.find((row) => row.guestName === 'chloé');
      // 1×150 − 0 − 0 − 0 + 60 = 210
      expect(guest?.score).toBe(210);
    });

    it('2.4 — the hint purchases are monotonic and add to 200, not 250', async () => {
      const purchases = await selectHintPurchases(database.db, SEED_PARTICIPANTS[0].id);
      expect(purchases.map((row) => row.level)).toEqual([1, 2]);
      expect(isMonotonic(purchases)).toBe(true);
      expect(purchases.reduce((total, row) => total + row.charged, 0)).toBe(200);
    });

    it('2.4 — the item uses read back, self-cast included', async () => {
      const uses = await selectItemUses(database.db, SEED_GAME.id);
      expect(uses.map((row) => row.itemId)).toEqual(['SCORE_STEAL', 'SCANNER']);
      expect(uses.find((row) => row.itemId === 'SCANNER')?.targetId).toBe(null);
    });

    it('2.5 — the cost of a game answers, and the failure is not in it', async () => {
      const totals = await readUsageTotals(database.db);
      expect(totals.gamesGenerated).toBe(1);

      const report = usageReport(totals);
      // Two successful calls on one generated game.
      expect(report.perGeneratedGame.llmCalls).toBe(2);
      // The failed call's 4 800 input tokens are in neither figure.
      expect(report.perGeneratedGame.inputTokens).toBe(5_680);
      expect(report.totals.inputTokens).toBe(5_680);
    });
  });
});
