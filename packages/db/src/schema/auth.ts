// The four tables Better Auth owns, plus nothing.
//
// Better Auth is wired in phase 4 step 4.2; these tables exist now because
// everything that persists hangs off a user. The shapes are its documented core
// schema, so that step configures the adapter rather than migrating on arrival.
// Checked against `getAuthTables` in better-auth 1.7.1 when it got there: they
// match, `account.issuer` included.
//
// Column names are snake_case in SQL and camelCase in TypeScript — the same
// split the protocol makes. The Drizzle adapter reads the property names, so
// `emailVerified` is what Better Auth sees.
import { boolean, index, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';

/** Timestamps every table carries, defined once. */
const stamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** Unique: Better Auth looks an account up by it. */
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  /**
   * A guest, in Better Auth's `anonymous` plugin sense — phase 4 step 4.3.
   *
   * Playing without signing up still creates a row here, because a guest needs
   * an *identity* and not just a nickname: two guests can type the same name,
   * and nothing else would connect the browser that played to the account
   * created afterwards. The plugin deletes the row once the account is real.
   *
   * Nullable and defaulted false, which is the plugin's own declaration; a row
   * that predates it reads as not anonymous, which is correct.
   */
  isAnonymous: boolean('is_anonymous').default(false),
  ...stamps,
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      // A deleted account takes its sessions with it: a session pointing at
      // nobody is a way in.
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Unique: this is the lookup key on every authenticated request. */
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    ...stamps,
  },
  (table) => [index('session_user_id_idx').on(table.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** The identity provider's own issuer, part of the compound identity. */
    issuer: text('issuer').notNull(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    idToken: text('id_token'),
    /** Hashed by Better Auth. Nullable: an OAuth account has none. */
    password: text('password'),
    ...stamps,
  },
  (table) => [
    unique('account_issuer_account_id_key').on(table.issuer, table.accountId),
    index('account_user_id_idx').on(table.userId),
  ],
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ...stamps,
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);
