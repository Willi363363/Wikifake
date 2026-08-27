// A database of this application's own, for its integration tests.
//
// Not the same one `@wikifake/db` uses: its suite truncates every table in
// `public` between tests, and Turbo runs package tasks in parallel. The
// machinery lives in `@wikifake/db/testing` because the realtime service needs a
// scratch database of its own too (step 5.8); what is decided here is only the
// name.
import {
  openScratchDatabase,
  scratchDatabaseUrl,
  scratchDatabaseUrlOrNull,
  type TestDatabase,
} from '@wikifake/db/testing';

/** This application's suffix. `…/wikifake` becomes `…/wikifake_web`. */
const SUFFIX = 'web';

export function webDatabaseUrl(base: string): string {
  return scratchDatabaseUrl(base, SUFFIX);
}

/** Where this application's test database is, or why there is none. */
export function webTestDatabaseUrl(): string | null {
  return scratchDatabaseUrlOrNull(SUFFIX);
}

/** Creates, migrates and truncates this application's own database. */
export function openWebTestDatabase(): Promise<TestDatabase> {
  return openScratchDatabase(SUFFIX);
}
