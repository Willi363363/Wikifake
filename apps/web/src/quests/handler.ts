// `POST /api/cron/quests` — step F.5.
//
// The one endpoint in this application that no player calls, so the only thing
// that decides whether it may run is a shared secret. Vercel sends it as
// `Authorization: Bearer <CRON_SECRET>` on a scheduled invocation.
//
// **Absent secret means refused, never open.** A forgotten variable must not
// turn this into a public endpoint that rewrites every player's quests — and the
// cost of failing closed is a cron that logs 503 until somebody sets it, which
// is a failure with a symptom. `REALTIME_ALLOWED_ORIGINS` made the same choice
// and the phase-9 harness caught the misconfiguration on its first run because
// of it.
import { questsApi } from '@wikifake/protocol';
import { loadEnv, type Env } from '@wikifake/env';

import { assignQuestsForActivePlayers, type CronContext } from './cron.js';
import { json } from '../respond.js';
import { logger } from '../logger.js';

export interface CronHandlerContext extends CronContext {
  readonly env: Env;
  /** The clock, as a parameter, so a test can run a Thursday. */
  now(): number;
}

/**
 * Constant-time enough for a token comparison.
 *
 * Not because a timing attack on a cron endpoint is likely, but because the
 * alternative — `a === b` — is the version somebody has to justify. Lengths are
 * compared first and that is a deliberate leak: the length of a secret is not
 * the secret, and looping to the longer of the two would compare a supplied
 * string against undefined bytes.
 */
function tokensMatch(supplied: string, expected: string): boolean {
  if (supplied.length !== expected.length) return false;

  let difference = 0;
  for (let index = 0; index < supplied.length; index += 1) {
    difference |= supplied.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

/** The bearer token on this request, if it carries one at all. */
function bearerOf(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (header === null) return null;

  const [scheme, ...rest] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return null;

  const token = rest.join(' ').trim();
  return token === '' ? null : token;
}

/**
 * A refusal, and deliberately not a `restError`.
 *
 * That shape is what a *client* branches on, and this endpoint has none: the
 * scheduler reads a status code and a person reads the log. Inventing an error
 * code for the protocol's closed union would add a member no client can ever
 * receive.
 */
function refused(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function handleQuestCron(
  context: CronHandlerContext,
  request: Request,
): Promise<Response> {
  const expected = context.env.CRON_SECRET;
  if (expected === undefined) {
    // 503 rather than 401: nothing is wrong with the request, the deployment is
    // not configured, and the two need to be distinguishable in a log.
    logger.error('quest cron called with no CRON_SECRET configured');
    return refused(503, 'This deployment has no cron secret configured.');
  }

  const supplied = bearerOf(request);
  if (supplied === null || !tokensMatch(supplied, expected)) {
    return refused(401, 'Not authorised.');
  }

  const outcome = await assignQuestsForActivePlayers(context, context.now());
  // The count is the evidence of idempotence rather than a claim about it: a
  // second run for the same day logs `assigned: 0`.
  logger.info(outcome, 'quest cron ran');

  return json(questsApi.questCronResponse, outcome);
}

/** What the route hands in. Lazy for the same reason `auth()` is. */
export function cronHandlerContext(db: CronContext['db']): CronHandlerContext {
  return { db, env: loadEnv(), now: () => Date.now() };
}
