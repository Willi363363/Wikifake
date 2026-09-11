// What a player can download, held to what the schema holds — step J.11.
//
// E.7 wrote the export when the schema had five tables a player appeared in.
// Tracks F, G and H then added coins, quests, hint purchases, item uses and
// leaderboard entries, and **not one of them reached the file a player
// downloads**. Nothing failed, because nothing compared the two.
//
// That is the defect this file is about, rather than any of the five rows: a
// right of access that quietly stops covering new data is worse than one nobody
// built, because the gap cannot be seen from outside.
//
// Two halves, and the first is the durable one:
//
//   - a **scan** of the schema directory: every table that references a `user`
//     or a `participant` must appear in `EXPORT_COVERAGE`, exported or exempt
//     with a reason;
//   - a **round trip** against a real Postgres: a player who played, earned,
//     spent, was assigned a quest and reached a board gets all of it back.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { EXPORT_COVERAGE, exportAccount } from './account.js';
import { openTestDatabase, testDatabaseUrl } from '../testing/database.js';
import { recordMovement } from './coins.js';
import { user } from '../schema/auth.js';
import { profile } from '../schema/profile.js';
import { game, participant } from '../schema/game.js';
import { hintPurchase } from '../schema/audit.js';
import { leaderboardEntry } from '../schema/leaderboard.js';
import { questAssignment } from '../schema/quests.js';
import type { TestDatabase } from '../testing/database.js';

const SCHEMA = join(dirname(fileURLToPath(import.meta.url)), '..', 'schema');

/**
 * Every `pgTable('name', …)` that references a user or a participation.
 *
 * The two are one question: `hint_purchase` and `item_use` key on a
 * *participation* rather than on an account, which is precisely how they stayed
 * invisible to the first version of the export — a scan that looked only for
 * `user.id` would have missed them exactly the way a person did.
 */
function tablesAboutPlayers(): string[] {
  const found: string[] = [];

  for (const file of readdirSync(SCHEMA)) {
    if (!file.endsWith('.ts') || file.includes('.test.')) continue;
    const source = readFileSync(join(SCHEMA, file), 'utf8');

    for (const match of source.matchAll(/pgTable\(\s*'([a-z_]+)'/g)) {
      const name = match[1] as string;
      // The table's own block, from its declaration to the next one.
      const start = match.index ?? 0;
      const next = source.indexOf('pgTable(', start + 1);
      const block = source.slice(start, next === -1 ? undefined : next);

      if (/references\(\(\) => (user|participant)\.id/.test(block)) found.push(name);
    }
  }

  return [...new Set(found)].sort();
}

const TABLES = tablesAboutPlayers();

describe('J.11 — every table about a player has been decided about', () => {
  it('found the schema', () => {
    // A scan of nothing covers nothing, and passes.
    expect(TABLES.length).toBeGreaterThan(6);
    expect(TABLES).toContain('coin_movement');
    // The two that key on a participation rather than on an account.
    expect(TABLES).toContain('hint_purchase');
    expect(TABLES).toContain('item_use');
  });

  it.each(TABLES)('says what the export does with %s', (table) => {
    expect({ table, decided: table in EXPORT_COVERAGE }).toEqual({
      table,
      decided: true,
    });
  });

  it('gives every exemption a reason rather than a silence', () => {
    const exemptions = Object.entries(EXPORT_COVERAGE).filter(([, value]) =>
      value.startsWith('exempt'),
    );

    expect(exemptions.length).toBeGreaterThan(2);
    for (const [table, reason] of exemptions) {
      // "exempt" alone is a decision nobody can argue with, which is the same
      // as one nobody made.
      expect({ table, argued: reason.length > 'exempt: '.length + 20 }).toEqual({
        table,
        argued: true,
      });
    }
  });
});

const url = testDatabaseUrl();

describe.skipIf(url === null)('J.11 — and a player gets all of it back', () => {
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

  /** A player who did one of everything the four tracks added. */
  async function busyPlayer(): Promise<string> {
    const id = 'ada';
    await store.db
      .insert(user)
      .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
    await store.db.insert(profile).values({
      userId: id,
      displayName: 'Ada',
      displayNameKey: 'ada',
      chosenRegion: 'europe',
      wornFrame: 'frame-gold',
    });

    const [round] = await store.db
      .insert(game)
      .values({
        mode: 'solo',
        topic: 'Chat',
        sourceUrl: 'https://fr.wikipedia.org/wiki/Chat',
        paragraphs: ['un paragraphe'],
        totalFakes: 3,
        timeLimit: 300,
      })
      .returning({ id: game.id });
    const [seat] = await store.db
      .insert(participant)
      .values({
        gameId: round?.id as string,
        userId: id,
        colour: '#1f574d',
        // `participant_score_with_submission`: a score is only a score once the
        // round was submitted, which the schema refuses to let a fixture forget.
        submittedAt: new Date('2026-09-11T12:00:00.000Z'),
        score: 40,
      })
      .returning({ id: participant.id });

    await recordMovement(store.db, {
      userId: id,
      amount: 20,
      source: 'quest_reward',
      idempotencyKey: 'quest:one',
    });
    await store.db.insert(questAssignment).values({
      userId: id,
      period: 'daily',
      periodIndex: 20_706,
      ruleId: 'DAILY_FINISH_ROUNDS',
      target: 3,
    });
    await store.db.insert(leaderboardEntry).values({
      participantId: seat?.id as string,
      userId: id,
      mode: 'solo',
      score: 40,
      finishedAt: new Date('2026-09-11T12:00:00.000Z'),
    });
    await store.db.insert(hintPurchase).values({
      participantId: seat?.id as string,
      falseInfoNumber: 1,
      level: 1,
      charged: 5,
    });

    return id;
  }

  it('carries the coins, the quests, the boards and the hints', async () => {
    const taken = await exportAccount(store.db, await busyPlayer());

    expect(taken?.coins.balance).toBe(20);
    expect(taken?.coins.movements).toHaveLength(1);
    expect(taken?.quests.map((quest) => quest.ruleId)).toEqual(['DAILY_FINISH_ROUNDS']);
    expect(taken?.boards.map((entry) => entry.score)).toEqual([40]);
    expect(taken?.hints.map((hint) => hint.charged)).toEqual([5]);
  });

  it('carries the region the network chose and the one the player did', async () => {
    // G.1's distinction, which an export showing only the effective region
    // would hide: one of these was derived from a request header.
    const taken = await exportAccount(store.db, await busyPlayer());

    expect(taken?.profile?.chosenRegion).toBe('europe');
    expect(taken?.profile?.derivedRegion).toBeNull();
  });

  it('carries what they are wearing', async () => {
    const taken = await exportAccount(store.db, await busyPlayer());

    expect(taken?.profile?.wornFrame).toBe('frame-gold');
  });

  it('says whether the account is an administrator', async () => {
    const taken = await exportAccount(store.db, await busyPlayer());

    expect(taken?.account.administrator).toBe(false);
  });

  it('still answers null for an account that is not there', async () => {
    expect(await exportAccount(store.db, 'nobody')).toBeNull();
  });
});
