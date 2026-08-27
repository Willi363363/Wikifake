// C7.2 — which version is running, and whether generation can work.
//
// This is the one endpoint that must answer when everything else is broken. It
// therefore does **not** go through `loadEnv`: that validates the whole
// environment — database, cache, model key — and a health probe that refuses to
// answer without a working database goes silent exactly when someone needs it.
// It reads the three variables it needs, directly, and validates none of them.
import { DEFAULT_MODEL_NAME } from '@wikifake/env';
import type { healthApi } from '@wikifake/protocol';

import pkg from '../package.json';

/**
 * Just the variables, read and not validated.
 *
 * `NodeJS.ProcessEnv` demands `NODE_ENV` once Next's types are loaded, and a
 * probe that reads three variables has no business requiring a fourth.
 */
export type Environment = Readonly<Record<string, string | undefined>>;

/**
 * The version, from the app's own manifest.
 *
 * Hand-maintained, like `backend/src/version.py` it replaces: the commit says
 * exactly what is running, the version says what was intended. A parity test
 * keeps the two from drifting while both exist.
 */
export const VERSION: string = pkg.version;

/**
 * The commit the platform says it deployed.
 *
 * On Vercel (the web app's host from phase 9 onward), the system variable is
 * `VERCEL_GIT_COMMIT_SHA`. The three Render-style variables follow for backward
 * compatibility while the Python still runs on Render: the CI probe compares
 * `commit` to the pushed SHA, and whichever host serves the response must
 * expose a value that matches.
 */
export function deployedCommit(source: Environment = process.env): string {
  return (
    source['VERCEL_GIT_COMMIT_SHA'] ??
    source['RENDER_GIT_COMMIT'] ??
    source['GIT_COMMIT'] ??
    source['SOURCE_COMMIT'] ??
    ''
  );
}

/**
 * The identity of this deployment.
 *
 * `commit` is a string present even when empty — locally there is no platform to
 * provide it. Optional would let the probe read `undefined` and wait forever,
 * which C7.2 exists to prevent.
 *
 * There is no field for the API key. `llmConfigured` says whether generation can
 * work; the key itself has nowhere to go, so there is nothing to leak.
 */
export function deploymentIdentity(
  source: Environment = process.env,
): healthApi.HealthResponse {
  const commit = deployedCommit(source);
  const key = source['GOOGLE_GENERATIVE_AI_API_KEY'];

  return {
    status: 'ok',
    version: VERSION,
    commit,
    // Seven characters, as the Python and as every `git log --oneline`.
    commitShort: commit.slice(0, 7),
    model: source['MODEL_NAME'] ?? DEFAULT_MODEL_NAME,
    llmConfigured: key !== undefined && key !== '',
  };
}
