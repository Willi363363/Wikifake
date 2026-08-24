// What happened, so it can be answered for afterwards.
//
// Three tables that turn in-memory facts into a record: what a player paid for,
// who sabotaged whom, and what a player reported. The first two make the
// guarantees of phase 1 auditable — a claim about billing that rests only on a
// dictionary in a process is a claim nobody can check after a restart.
//
// The enumerations come from `@wikifake/protocol`. Redeclaring them here is how
// the database and the wire end up disagreeing, which is D8 with a slower
// feedback loop.
import { ITEM_IDS, flagsApi } from '@wikifake/protocol';
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { user } from './auth.js';
import { game, participant } from './game.js';

/**
 * A Postgres enum needs a non-empty tuple; `z.enum(...).options` is an array.
 *
 * The throw cannot fire — a Zod enum always has at least one value — but saying
 * so out loud is better than an assertion that hides why it is safe.
 */
function nonEmpty<T extends string>(values: readonly T[]): [T, ...T[]] {
  const [first, ...rest] = values;
  if (first === undefined) throw new Error('a Postgres enum needs at least one value');
  return [first, ...rest];
}

/** D8 — the item identifiers, taken from the contract rather than retyped. */
export const itemIdEnum = pgEnum('item_id', ITEM_IDS);

export const flagStatusEnum = pgEnum(
  'flag_status',
  nonEmpty(flagsApi.flagStatus.options),
);
export const flagVerdictEnum = pgEnum(
  'flag_verdict',
  nonEmpty(flagsApi.flagVerification.shape.verdict.options),
);
export const flagRecommendationEnum = pgEnum(
  'flag_recommendation',
  nonEmpty(flagsApi.flagVerification.shape.recommendation.options),
);

/**
 * C1.4, C2.2 — one row per level actually billed.
 *
 * The unique constraint is the guarantee, not the record of it: a level cannot
 * be charged twice, whatever the in-memory ledger believes. That is what the
 * contract means by locking monotonicity with something other than process
 * state.
 *
 * A request that grants a level the player already held is charged nothing, and
 * so is not a purchase and not written here — hence `charged > 0`. The sequence
 * of rows, in timestamp order, is what makes monotonicity checkable after the
 * fact: the levels for one falsification only ever go up.
 */
export const hintPurchase = pgTable(
  'hint_purchase',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    participantId: uuid('participant_id')
      .notNull()
      .references(() => participant.id, { onDelete: 'cascade' }),
    /** C3.3 — which falsification, 1-based. */
    falseInfoNumber: integer('false_info_number').notNull(),
    /** 1 for a nudge, 2 for a reveal. */
    level: integer('level').notNull(),
    /** What **this** purchase cost. Not the price of the level (see `charged`). */
    charged: integer('charged').notNull(),
    purchasedAt: timestamp('purchased_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('hint_purchase_once_per_level').on(
      table.participantId,
      table.falseInfoNumber,
      table.level,
    ),
    index('hint_purchase_participant_idx').on(table.participantId, table.purchasedAt),
    check('hint_purchase_level_range', sql`${table.level} in (1, 2)`),
    check('hint_purchase_number_1_based', sql`${table.falseInfoNumber} >= 1`),
    check('hint_purchase_was_charged', sql`${table.charged} > 0`),
  ],
);

/**
 * Who sabotaged whom, with what, when.
 *
 * `targetId` is null for an item that lands on its caster — the SCANNER is the
 * only one. The check refuses a caster targeting themselves, which is D6 closed
 * a second time: `domain` refuses it, and here it cannot be recorded at all.
 */
export const itemUse = pgTable(
  'item_use',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => game.id, { onDelete: 'cascade' }),
    casterId: uuid('caster_id')
      .notNull()
      .references(() => participant.id, { onDelete: 'cascade' }),
    targetId: uuid('target_id').references(() => participant.id, { onDelete: 'cascade' }),
    itemId: itemIdEnum('item_id').notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('item_use_game_idx').on(table.gameId, table.usedAt),
    check(
      'item_use_no_self_target',
      sql`${table.targetId} is null or ${table.targetId} != ${table.casterId}`,
    ),
  ],
);

/**
 * A player reporting a **real** factual error, as opposed to one the game
 * injected. Replaces `backend/data/complaints.jsonl`, which lived on an
 * ephemeral disk and was therefore lost on every redeployment.
 *
 * The model's verdict is stored beside the report: a report whose assessment
 * lives somewhere else is a report nobody can triage.
 */
export const flagReport = pgTable(
  'flag_report',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Null when the report does not come from a game — a shared link, say. */
    gameId: uuid('game_id').references(() => game.id, { onDelete: 'set null' }),
    /** Null for a guest, which most reporters are. */
    reporterId: text('reporter_id').references(() => user.id, { onDelete: 'set null' }),
    articleTitle: text('article_title').notNull(),
    articleUrl: text('article_url').notNull().default(''),
    flaggedClaim: text('flagged_claim').notNull(),
    proposedCorrection: text('proposed_correction').notNull(),
    quickNote: text('quick_note').notNull().default(''),
    explanation: text('explanation').notNull().default(''),
    /** What the player cited. A list, so `jsonb`. */
    sources: jsonb('sources').notNull().default([]),
    status: flagStatusEnum('status').notNull(),
    verdict: flagVerdictEnum('verdict').notNull(),
    confidence: integer('confidence').notNull(),
    reasoning: text('reasoning').notNull(),
    sourcesFound: jsonb('sources_found').notNull().default([]),
    recommendation: flagRecommendationEnum('recommendation').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('flag_report_status_idx').on(table.status, table.createdAt),
    check('flag_report_confidence_range', sql`${table.confidence} between 0 and 100`),
  ],
);
