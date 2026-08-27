// Error tracking — Sentry initialisation for the web (Next.js) app.
//
// Called once at server startup. The DSN is optional: absent locally and in CI,
// which is intentional. Sentry is not a development tool, and an absent DSN
// means "this process does not report to Sentry" — not a misconfigured one.
//
// The release is tagged with the deployed commit so that each error is pinned to
// exactly what was running when it occurred. Without it, a recurring error that
// was fixed in one deploy would still point at the wrong source line.
import * as Sentry from '@sentry/node';

import { deployedCommit } from './deployment.js';

/**
 * Initialise Sentry.
 *
 * Safe to call more than once — Sentry deduplicates initialisations with the
 * same DSN. Returns without doing anything when the DSN is not set, so the
 * rest of the application does not need to branch on Sentry availability.
 */
export function initSentry(
  source: Record<string, string | undefined> = process.env,
): void {
  const dsn = source['SENTRY_DSN'];
  if (!dsn) return;

  Sentry.init({
    dsn,
    release: deployedCommit(source) || undefined,
    environment: source['NODE_ENV'] ?? 'development',
  });
}
