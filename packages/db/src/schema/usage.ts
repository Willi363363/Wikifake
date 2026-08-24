// What the model cost.
//
// C4.6 — `usage.py` keeps these counters in memory, so `/api/usage` restarts
// from zero on every redeployment and the only number that matters — what a game
// costs against what it earns — was never measurable over more than one uptime.
// In a table, the cost of a game is a query.
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { game } from './game.js';

/**
 * What the call was for.
 *
 * `topic_choice` and `falsification` are the two `usage.py` records today, in
 * English. `flag_verification` is a third: `flag_verifier.py` calls the model and
 * records nothing, so the cost of verifying a player's report is currently
 * invisible. Recorded in `plans/current-state/05-known-debt.md`.
 */
export const llmCallKind = pgEnum('llm_call_kind', [
  'topic_choice',
  'falsification',
  'flag_verification',
]);

export const llmCall = pgTable(
  'llm_call',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * Null when there is no game to attach it to — a topic choice that found
     * nothing, or a failed falsification, since a failure never becomes a game.
     */
    gameId: uuid('game_id').references(() => game.id, { onDelete: 'set null' }),
    model: text('model').notNull(),
    kind: llmCallKind('kind').notNull(),
    /**
     * What the model reported. Null when it did not report usage: the character
     * counts below are the proxy `usage.py` already falls back on, and a proxy
     * that says so is better than a zero that looks like a measurement.
     */
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    promptChars: integer('prompt_chars').notNull(),
    outputChars: integer('output_chars').notNull(),
    /** C4.5 — a failure is recorded as one, and counted as nothing else. */
    failed: boolean('failed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('llm_call_kind_idx').on(table.kind, table.createdAt),
    index('llm_call_game_idx').on(table.gameId),
    check(
      'llm_call_tokens_not_negative',
      sql`
      (${table.inputTokens} is null or ${table.inputTokens} >= 0)
      and (${table.outputTokens} is null or ${table.outputTokens} >= 0)
    `,
    ),
  ],
);
