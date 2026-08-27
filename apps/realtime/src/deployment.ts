// C7.2 — which version this service is running, for the CI probe.
//
// Mirrors `apps/web/src/deployment.ts` field for field: the probe polls both
// services and compares the same `commit` key against the same pushed SHA, so a
// shape that differs between the two is a probe that verifies one of them.
//
// Like the web version, it does **not** go through `loadEnv`. A health probe
// that refuses to answer without a working database goes silent exactly when
// someone needs it.
import { DEFAULT_MODEL_NAME } from '@wikifake/env';
import type { healthApi } from '@wikifake/protocol';

import pkg from '../package.json' with { type: 'json' };

/** Just the variables, read and not validated. */
export type Environment = Readonly<Record<string, string | undefined>>;

/** The version, from this app's own manifest. */
export const VERSION: string = pkg.version;

/**
 * The commit the platform says it deployed.
 *
 * Fly injects no commit variable of its own — unlike Vercel's
 * `VERCEL_GIT_COMMIT_SHA` and Render's `RENDER_GIT_COMMIT`. `FLY_GIT_COMMIT` is
 * therefore passed as a build argument by the deploy workflow and baked into the
 * image, which is what lets this answer the SHA the probe compares against.
 */
export function deployedCommit(source: Environment = process.env): string {
  return (
    source['FLY_GIT_COMMIT'] ??
    source['GIT_COMMIT'] ??
    source['SOURCE_COMMIT'] ??
    ''
  );
}

/**
 * The identity of this deployment.
 *
 * `commit` is a string present even when empty — locally there is no platform to
 * provide it. Optional would let the probe read `undefined` and wait forever.
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
    commitShort: commit.slice(0, 7),
    model: source['MODEL_NAME'] ?? DEFAULT_MODEL_NAME,
    llmConfigured: key !== undefined && key !== '',
  };
}
