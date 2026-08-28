// Error tracking — Sentry initialisation for the realtime (Hono/Node) service.
//
// Mirrors `apps/web/src/sentry.ts`. Called once at startup, before any request
// is served. Absent DSN → no-op, which is the correct behaviour locally and in
// CI where there is no target project to report to.
import * as Sentry from '@sentry/node';

import { deployedCommit } from './deployment.js';

/**
 * Initialise Sentry for the realtime service.
 *
 * The release is the git commit the platform injected at deploy time, so every
 * error is pinned to the exact revision that caused it.
 */
export function initSentry(
  source: Record<string, string | undefined> = process.env,
): void {
  const dsn = source['SENTRY_DSN'];
  if (!dsn) return;

  Sentry.init({
    dsn,
    // Through `deployedCommit`, like the web app: the release and `/api/health`
    // must name the same revision, and two chains drift. It also removes a gate
    // on `FLY_APP_NAME` that made every release untagged the moment the service
    // moved host — the bug `sentry.test.ts` now holds shut.
    release: deployedCommit(source) || undefined,
    environment: source['NODE_ENV'] ?? 'development',
  });
}
