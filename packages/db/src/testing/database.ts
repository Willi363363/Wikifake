// A migrated database for a test, and nothing left behind.
//
// The pitfall this answers: "take a fresh database on every run, otherwise the
// migrations are never really tested". A suite that runs against a database
// somebody already migrated proves the queries and nothing about the schema.
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';

import { connect, type Database } from '../client.js';
import { room } from '../schema/game.js';

const MIGRATIONS = fileURLToPath(new URL('../../migrations', import.meta.url));

/**
 * Where the test database is, or why there is none.
 *
 * Absent locally is a skip; absent in CI is a failure. A suite that quietly
 * skips its integration tests on the machine that decides whether to merge is
 * worse than no suite: it reports green for work it never did.
 */
export function testDatabaseUrl(): string | null {
  const url = process.env['DATABASE_URL'];
  if (url !== undefined && url !== '') return url;
  if (process.env['CI'] === 'true') {
    throw new Error(
      'DATABASE_URL is required in CI: the integration tests must actually run',
    );
  }
  return null;
}

export interface TestDatabase {
  readonly db: Database['db'];
  readonly truncate: () => Promise<void>;
  readonly close: () => Promise<void>;
}

/**
 * Postgres error classes, by SQLSTATE.
 *
 * Asserted on rather than the message: `postgres.js` reports "Failed query: …"
 * and keeps the class in a property, so matching the text would pass for any
 * failure at all — including a typo in the query.
 */
export const SQLSTATE = {
  uniqueViolation: '23505',
  foreignKeyViolation: '23503',
  notNullViolation: '23502',
  checkViolation: '23514',
} as const;

/**
 * The SQLSTATE a query failed with, or null if it succeeded.
 *
 * Drizzle wraps the driver's error in its own, so the class sits one or more
 * `cause` links down. Walking the chain rather than reading the top error is
 * what makes this survive a Drizzle upgrade that adds another wrapper.
 */
export async function rejectionCode(work: Promise<unknown>): Promise<string | null> {
  try {
    await work;
    return null;
  } catch (error) {
    let current: unknown = error;
    while (typeof current === 'object' && current !== null) {
      if ('code' in current && typeof (current as { code: unknown }).code === 'string') {
        return (current as { code: string }).code;
      }
      current = (current as { cause?: unknown }).cause;
    }
    return `no SQLSTATE in: ${String(error)}`;
  }
}

/** Opens a connection, applies every migration, and hands back a clean database. */
export async function openTestDatabase(url: string): Promise<TestDatabase> {
  // One connection: a transaction left open shows up as a hang in the test that
  // leaked it, rather than as another test failing later for no visible reason.
  const { db, close } = connect({ url, max: 1 });
  await migrate(db, { migrationsFolder: MIGRATIONS });

  // Every table in `public`, discovered rather than listed.
  //
  // A hand-written list is a list that drifts: the first table added after it was
  // written left a row behind between tests, and the failure surfaced as a
  // primary key collision in an unrelated test. Drizzle keeps its migration
  // journal in its own schema, so `public` is exactly the application's tables.
  const truncate = async (): Promise<void> => {
    const tables = await db.execute<{ name: string }>(
      sql`select table_name as name from information_schema.tables
          where table_schema = 'public' and table_type = 'BASE TABLE'`,
    );
    const names = [...tables].map((row) => `"${row.name}"`);
    if (names.length === 0) return;
    await db.execute(sql.raw(`truncate table ${names.join(', ')} cascade`));
  };

  await truncate();
  return { db, truncate, close };
}

/** Postgres says "database already exists" with this SQLSTATE. */
const DUPLICATE_DATABASE = '42P04';

/** `…/wikifake` becomes `…/wikifake_web`, `…/wikifake_realtime`, and so on. */
export function scratchDatabaseUrl(base: string, suffix: string): string {
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/\/+$/, '')}_${suffix}`;
  return url.toString();
}

/**
 * Where an application's own test database is, or why there is none.
 *
 * Absent locally is a skip, absent in CI is a failure — the same contract as
 * `testDatabaseUrl`, for the same reason: a suite that quietly skips on the
 * machine deciding whether to merge reports green for work it never did.
 */
export function scratchDatabaseUrlOrNull(suffix: string): string | null {
  const base = process.env['DATABASE_URL'];
  if (base !== undefined && base !== '') return scratchDatabaseUrl(base, suffix);
  if (process.env['CI'] === 'true') {
    throw new Error(
      'DATABASE_URL is required in CI: the integration tests must actually run',
    );
  }
  return null;
}

function sqlstate(error: unknown): string | undefined {
  let current: unknown = error;
  while (typeof current === 'object' && current !== null) {
    if ('code' in current && typeof (current as { code: unknown }).code === 'string') {
      return (current as { code: string }).code;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Creates the database if it is not there yet. Idempotent, and concurrent-safe. */
async function ensureDatabase(base: string, name: string): Promise<void> {
  const admin = postgres(base, { max: 1 });
  try {
    // `create database` cannot run inside a transaction, hence `unsafe`. The name
    // is derived from DATABASE_URL, not from anything a request supplied.
    await admin.unsafe(`create database "${name}"`);
  } catch (error) {
    // Already there — including because a parallel run got here first.
    if (sqlstate(error) !== DUPLICATE_DATABASE) throw error;
  } finally {
    await admin.end();
  }
}

/**
 * Creates, migrates and truncates a database of one application's own.
 *
 * Not the shared one. This package's own suite truncates every table in `public`
 * between tests and Turbo runs package tasks in parallel, so a test elsewhere
 * touching the shared database has its rows deleted mid-flight. That race has now
 * come up three times in the rewrite — a Postgres deadlock in phase 2, Redis
 * namespaces in phase 3, this in phase 4 — so it gets a boundary rather than a
 * third workaround.
 */
export async function openScratchDatabase(suffix: string): Promise<TestDatabase> {
  const base = process.env['DATABASE_URL'];
  if (base === undefined || base === '') {
    throw new Error('openScratchDatabase needs DATABASE_URL');
  }

  const target = scratchDatabaseUrl(base, suffix);
  const name = new URL(target).pathname.replace(/^\//, '');
  await ensureDatabase(base, name);
  return openTestDatabase(target);
}

/**
 * Makes every room look as though nobody has touched it since `at`.
 *
 * A fixture, and it lives here rather than beside the test that needs it: the
 * application declares no ORM — phase 2's exit gate, no free-form SQL outside
 * this package — and "a room that has been idle for an hour" is not something a
 * caller can produce by waiting.
 *
 * No production path writes `updated_at` by hand; phase 5 refreshes it as rooms
 * are used.
 */
export async function backdateRooms(db: Database['db'], at: Date): Promise<void> {
  await db.update(room).set({ updatedAt: at });
}
