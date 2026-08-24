// The client, created once.
//
// One driver for every environment. `postgres.js` speaks plain Postgres, which
// is what Neon serves over TCP and what a container serves in a test — so the
// code that runs against production is the code the tests exercise. A separate
// serverless driver would mean two code paths and only one of them tested.
//
// Phase 9 revisits this if a serverless deployment needs the HTTP driver; until
// then, one path.
import { loadEnv } from '@wikifake/env';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema/index.js';

export type Database = ReturnType<typeof connect>;

export interface ConnectionOptions {
  /** Postgres connection string. Validated by `@wikifake/env` at startup. */
  readonly url: string;
  /**
   * How many connections to hold. One in tests, so a leaked transaction shows
   * up as a hang in the test that leaked it rather than as flakiness later.
   */
  readonly max?: number;
}

/**
 * Opens a connection.
 *
 * Returns the driver alongside the query builder, because a caller that opens a
 * connection has to be able to close it: a test that cannot is a test suite that
 * never exits.
 */
export function connect(options: ConnectionOptions) {
  const sql = postgres(options.url, { max: options.max ?? 10 });
  return { db: drizzle(sql, { schema }), close: async (): Promise<void> => sql.end() };
}

/**
 * Opens a connection from the validated environment.
 *
 * The path the application takes. `loadEnv` refuses a missing or malformed
 * `DATABASE_URL` by name (phase 0), so a bad configuration fails at startup
 * rather than surfacing as a connection error under load.
 */
export function connectFromEnv(source?: Record<string, string | undefined>): Database {
  const env = source === undefined ? loadEnv() : loadEnv(source);
  return connect({ url: env.DATABASE_URL });
}
