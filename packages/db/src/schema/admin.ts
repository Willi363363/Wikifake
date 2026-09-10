// Who may read the panel — step I.1.
//
// **A table and not a column on `user`.** `auth.ts` says in its first line that
// it holds "the four tables Better Auth owns, plus nothing", and that boundary
// is worth more than the one join this costs: a column of ours in a library's
// table is a column the library's own migrations do not know about, and the day
// Better Auth changes its core schema is the day it matters.
//
// One row per admin, and **no code writes it**. Track I is read-only — its exit
// gate says "no write, no mutation, no destructive action anywhere in the diff"
// — so granting is a statement a person runs, which is exactly what the plan
// asked for: *a flag on the account, set by a migration, not by a screen*.
//
// The statement, for whoever needs it:
//
// ```sql
// insert into admin (user_id) select id from "user" where email = '…';
// ```
//
// **The table arrives empty, and that is the safe default**: no admins means the
// route answers 404 to everybody, including whoever deployed it. An admin panel
// that let its first visitor in would be an admin panel with no access control
// at all for exactly as long as nobody noticed.
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { user } from './auth.js';

export const admin = pgTable('admin', {
  /**
   * The account, and the primary key.
   *
   * The account's own id as the key rather than a synthetic one, because *this
   * account is an admin* is a fact that can only be true once — a second row
   * for the same person would be a state nobody can interpret, and a unique
   * constraint beside a serial id is the same thing said twice.
   */
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),

  /**
   * When it was granted. Recorded because *who has this and since when* is the
   * first question asked of any privileged list, and a row with no date cannot
   * answer it.
   */
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),

  /**
   * Why, in a person's words. Free text and nullable.
   *
   * Nullable because the statement above does not fill it and a required column
   * would make the honest one-liner impossible; recorded because a privileged
   * list nobody can explain is a list nobody dares remove anybody from.
   */
  note: text('note'),
});
