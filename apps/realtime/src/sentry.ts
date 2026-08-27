// Error tracking — Sentry initialisation for the realtime (Hono/Node) service.
//
// Mirrors `apps/web/src/sentry.ts`. Called once at startup, before any request
// is served. Absent DSN → no-op, which is the correct behaviour locally and in
// CI where there is no target project to report to.
import * as Sentry from '@sentry/node';

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

  const commit =
    source['FLY_APP_NAME'] !== undefined
      ? (source['FLY_GIT_COMMIT'] ??
        source['GIT_COMMIT'] ??
        source['SOURCE_COMMIT'] ??
        '')
      : '';

  Sentry.init({
    dsn,
    release: commit || undefined,
    environment: source['NODE_ENV'] ?? 'development',
  });
}
