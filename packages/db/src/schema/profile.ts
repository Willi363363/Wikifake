// What a player chose, as opposed to who they are.
//
// Separate from `user` because that table belongs to Better Auth: adding columns
// to it means the adapter and the migration disagree the day its core schema
// changes. One row per account, created with it.
import { jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';

import { user } from './auth.js';

export const profile = pgTable(
  'profile',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** What other players see. Distinct from `user.name`, which is the account's. */
    displayName: text('display_name').notNull(),
    /**
     * E.3.1 — the same pseudonym folded, and what uniqueness is decided on.
     *
     * `pseudonymKey` in `@wikifake/protocol` is the only thing that writes it,
     * and `queries/profile.ts` is the only thing that calls that. A stored
     * column rather than a `unique index on lower(display_name)`, because the
     * two are not equivalent: Postgres folds case through the database's
     * collation and JavaScript folds it through the Unicode table, and under a
     * `C` collation those disagree on every accented letter. A rule that lives
     * in one language cannot drift from itself.
     *
     * Denormalised on purpose, and the one kind that is safe: it is a pure
     * function of the column beside it, written in the same statement.
     */
    displayNameKey: text('display_name_key').notNull(),
    /**
     * The accent the interface is drawn in.
     *
     * Text rather than an enum: the palette belongs to the design system of
     * phase 6, and a Postgres enum would make adding a colour a migration.
     */
    accent: text('accent').notNull().default('teal'),
    /**
     * Everything else a player toggles — sound, reduced motion, and whatever
     * phase 6 adds.
     *
     * `jsonb` because these are preferences, not data anything queries or joins
     * on. A column per toggle would be a migration per toggle.
     */
    preferences: jsonb('preferences').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // The constraint, not a check in the application: two sign-ups racing for the
  // same pseudonym are two transactions, and only the database sees both.
  (table) => [unique('profile_display_name_key_key').on(table.displayNameKey)],
);
