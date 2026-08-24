// A database of this application's own, for its integration tests.
//
// Not the same one `@wikifake/db` uses. Its suite truncates every table in
// `public` between tests, Turbo runs package tasks in parallel, so a test here
// touching the shared database would have its rows deleted mid-flight by a suite
// in another package. That is the third time this shape of race has come up in
// the rewrite — Postgres deadlock in phase 2, Redis namespaces in phase 3 — so
// this time it gets a boundary rather than a workaround.
import { openTestDatabase, type TestDatabase } from '@wikifake/db/testing';
import postgres from 'postgres';

/** Postgres says "database already exists" with this SQLSTATE. */
const DUPLICATE_DATABASE = '42P04';

/** `…/wikifake` becomes `…/wikifake_web`. */
export function webDatabaseUrl(base: string): string {
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/\/+$/, '')}_web`;
  return url.toString();
}

/**
 * Where this application's test database is, or why there is none.
 *
 * Absent locally is a skip, absent in CI is a failure — the same contract as
 * `testDatabaseUrl` in `@wikifake/db`, for the same reason: a suite that quietly
 * skips on the machine deciding whether to merge reports green for work it never
 * did.
 */
export function webTestDatabaseUrl(): string | null {
  const base = process.env['DATABASE_URL'];
  if (base !== undefined && base !== '') return webDatabaseUrl(base);
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

/** Creates, migrates and truncates this application's own database. */
export async function openWebTestDatabase(): Promise<TestDatabase> {
  const base = process.env['DATABASE_URL'];
  if (base === undefined || base === '') {
    throw new Error('openWebTestDatabase needs DATABASE_URL');
  }

  const target = webDatabaseUrl(base);
  const name = new URL(target).pathname.replace(/^\//, '');
  await ensureDatabase(base, name);
  return openTestDatabase(target);
}
