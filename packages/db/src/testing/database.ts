// A migrated database for a test, and nothing left behind.
//
// The pitfall this answers: "take a fresh database on every run, otherwise the
// migrations are never really tested". A suite that runs against a database
// somebody already migrated proves the queries and nothing about the schema.
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import { fileURLToPath } from 'node:url';

import { connect, type Database } from '../client.js';

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
