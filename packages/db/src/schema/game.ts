// A game, and everything that happened during it.
//
// `game_position` is the solution. It sits in its own table rather than in the
// game's snapshot for one reason: a column cannot be left out of a query, and a
// table can. C1.1 says the solution never reaches a player before the end, and
// the read queries of `queries/game.ts` are what enforce it — a test asserts
// they do not so much as mention this table.
//
// No business logic here. `participant` stores the breakdown `domain` computed;
// nothing recomputes it, and there is no trigger.
import { relations } from 'drizzle-orm';
import {
  boolean,
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
import { sql } from 'drizzle-orm';

import { user } from './auth.js';

/** The room phases of `@wikifake/domain`. A room cannot be in two at once. */
export const roomPhase = pgEnum('room_phase', ['lobby', 'voting', 'generating', 'round']);

/** Solo goes through REST, multiplayer through the socket. Same rules, same tables. */
export const gameMode = pgEnum('game_mode', ['solo', 'multiplayer']);

export const room = pgTable('room', {
  /** C5.6 — the six-character join code, and the natural key. */
  code: text('code').primaryKey(),
  /**
   * Whoever is host right now, by name.
   *
   * A name rather than a user id, because a guest can be host. Null when the
   * room is empty — which, in the live system, is a room about to disappear.
   */
  hostName: text('host_name'),
  phase: roomPhase('phase').notNull().default('lobby'),
  withItems: boolean('with_items').notNull().default(true),
  timeLimit: integer('time_limit').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const game = pgTable(
  'game',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Null in solo: there is no room. */
    roomCode: text('room_code').references(() => room.code, { onDelete: 'set null' }),
    mode: gameMode('mode').notNull(),
    topic: text('topic').notNull(),
    /** C6.1 — the source link, part of the attribution. */
    sourceUrl: text('source_url').notNull(),
    /**
     * The falsified paragraphs, as they were served.
     *
     * A snapshot, and treated as one: it is not re-normalised, because the text
     * a player was graded on is the text they read. Normalisation belongs to
     * phase 3 and happens before this is written.
     */
    paragraphs: jsonb('paragraphs').notNull(),
    totalFakes: integer('total_fakes').notNull(),
    /** Kept with the game: the time bonus of C2.1 cannot be recomputed without it. */
    timeLimit: integer('time_limit').notNull(),
    /**
     * C4.6 — whether this game reused an article instead of generating one.
     *
     * It is the denominator of `cache_hit_rate` and, more importantly, what
     * keeps the cost per game from being diluted: a cached game costs nothing
     * and averaging it in would make generation look cheaper than it is.
     */
    fromCache: boolean('from_cache').notNull().default(false),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    /** Null while the round is still running. */
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    index('game_room_code_idx').on(table.roomCode),
    check('game_total_fakes_positive', sql`${table.totalFakes} > 0`),
  ],
);

/**
 * C1.2 — the solution. One row per falsification.
 *
 * `originalText` is here and travels nowhere: the protocol has no field for it,
 * because a diff against the falsified paragraph solved the game. It is kept for
 * the debrief and for auditing what the model actually changed.
 */
export const gamePosition = pgTable(
  'game_position',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => game.id, { onDelete: 'cascade' }),
    /** C3.3 — 1-based. */
    paragraphIndex: integer('paragraph_index').notNull(),
    /** C3.3 — sequential from 1 to n. */
    falseInfoNumber: integer('false_info_number').notNull(),
    falseStatement: text('false_statement').notNull(),
    originalText: text('original_text').notNull(),
    explanation: text('explanation').notNull(),
    hint: text('hint').notNull(),
  },
  (table) => [
    // C3.3, as constraints rather than as hope: two falsifications cannot share
    // a paragraph, and a number cannot repeat inside a game.
    unique('game_position_game_paragraph_key').on(table.gameId, table.paragraphIndex),
    unique('game_position_game_number_key').on(table.gameId, table.falseInfoNumber),
    check('game_position_paragraph_1_based', sql`${table.paragraphIndex} >= 1`),
    check('game_position_number_1_based', sql`${table.falseInfoNumber} >= 1`),
  ],
);

export const participant = pgTable(
  'participant',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => game.id, { onDelete: 'cascade' }),
    /**
     * An account, or a guest — exactly one.
     *
     * Guests are the majority today: the game is playable without signing up,
     * and that stays true. The check is what stops a row from being neither,
     * which would be a score belonging to nobody.
     */
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    guestName: text('guest_name'),
    colour: text('colour').notNull(),
    /** Null until they submit. Everything below it is null with it. */
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    score: integer('score'),
    truePositives: integer('true_positives'),
    falsePositives: integer('false_positives'),
    hintsUsed: integer('hints_used'),
    hintPenalty: integer('hint_penalty'),
    scoreStolen: integer('score_stolen'),
    timeBonus: integer('time_bonus'),
  },
  (table) => [
    index('participant_game_id_idx').on(table.gameId),
    index('participant_user_id_idx').on(table.userId),
    check(
      'participant_account_or_guest',
      sql`(${table.userId} is null) != (${table.guestName} is null)`,
    ),
    // A score without a submission is a score nobody earned, and a submission
    // without a score is a debrief with a hole in it.
    check(
      'participant_score_with_submission',
      sql`(${table.submittedAt} is null) = (${table.score} is null)`,
    ),
  ],
);

/**
 * What a participant marked. One row per paragraph.
 *
 * D11 — the unique constraint is the same defect closed a second time: marking a
 * paragraph three times counted three true positives. `domain` counts it once,
 * and here it cannot be written twice at all.
 */
export const answer = pgTable(
  'answer',
  {
    participantId: uuid('participant_id')
      .notNull()
      .references(() => participant.id, { onDelete: 'cascade' }),
    paragraphIndex: integer('paragraph_index').notNull(),
  },
  (table) => [
    unique('answer_participant_paragraph_key').on(
      table.participantId,
      table.paragraphIndex,
    ),
    check('answer_paragraph_1_based', sql`${table.paragraphIndex} >= 1`),
  ],
);

export const gameRelations = relations(game, ({ many, one }) => ({
  positions: many(gamePosition),
  participants: many(participant),
  room: one(room, { fields: [game.roomCode], references: [room.code] }),
}));

export const participantRelations = relations(participant, ({ many, one }) => ({
  answers: many(answer),
  game: one(game, { fields: [participant.gameId], references: [game.id] }),
}));
