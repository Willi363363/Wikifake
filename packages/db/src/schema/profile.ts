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
     * G.1 — where the CDN said the request came from, mapped to a region.
     *
     * `x-vercel-ip-country`, through `regionForCountry`, and **written once**:
     * at the moment this row is created. Not refreshed, deliberately — a header
     * follows the network rather than the person, so re-deriving it would move a
     * travelling player's board under them every trip.
     *
     * Null on a row created before this step, which `effectiveRegion` reads as
     * `other` rather than as an error.
     */
    derivedRegion: text('derived_region'),
    /**
     * G.1 — the region the player set for themselves, which always wins.
     *
     * Two columns rather than one with a flag, so each means exactly one thing:
     * this is a choice and the one above is an inference, and no code has to ask
     * which a single value happens to be.
     *
     * **A column and not a `preferences` key**, unlike every other thing a
     * player toggles. The comment on that column says why: `jsonb` is for
     * preferences that nothing queries or joins on, and a regional board is a
     * `where` clause on this value.
     */
    chosenRegion: text('chosen_region'),
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
