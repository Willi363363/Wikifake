// `POST /api/cron/daily` — step N.4.
//
// The second endpoint no player calls, and it makes the same choices as the
// first for the same reasons — `quests/handler.ts` argues them once and this
// follows: an absent secret means refused rather than open, the comparison is
// constant-time enough, and a refusal here is not a `restError` because the
// caller is a scheduler reading a status code, not a client branching on a code.
import { dailyApi } from '@wikifake/protocol';
import { loadEnv, type Env } from '@wikifake/env';

import { prepareDailyArticle } from './cron.js';
import type { DailyDependencies } from './article.js';
import { dailyDependencies } from './wiring.js';
import { logger } from '../logger.js';
import { json } from '../respond.js';

export interface DailyCronContext {
  readonly daily: DailyDependencies;
  readonly env: Env;
  /** The clock, as a parameter, so a test can run a given day. */
  now(): number;
}

/** Constant-time enough for a token comparison — `quests/handler.ts` says why. */
function tokensMatch(supplied: string, expected: string): boolean {
  if (supplied.length !== expected.length) return false;

  let difference = 0;
  for (let index = 0; index < supplied.length; index += 1) {
    difference |= supplied.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function bearerOf(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (header === null) return null;

  const [scheme, ...rest] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return null;

  const token = rest.join(' ').trim();
  return token === '' ? null : token;
}

function refused(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function handleDailyCron(
  context: DailyCronContext,
  request: Request,
): Promise<Response> {
  const expected = context.env.CRON_SECRET;
  if (expected === undefined) {
    // 503 rather than 401: nothing is wrong with the request, the deployment is
    // not configured, and a log has to tell the two apart.
    logger.error('daily cron called with no CRON_SECRET configured');
    return refused(503, 'This deployment has no cron secret configured.');
  }

  const supplied = bearerOf(request);
  if (supplied === null || !tokensMatch(supplied, expected)) {
    return refused(401, 'Not authorised.');
  }

  const outcome = await prepareDailyArticle(context.daily, context.now());
  // `generated: false` on a second run for the same day is the evidence of
  // idempotence rather than a claim about it.
  logger.info(outcome, 'daily cron ran');

  return json(dailyApi.dailyCronResponse, outcome);
}

/** What the route hands in. Lazy for the reason `auth()` is. */
export function dailyCronContext(): DailyCronContext {
  return { daily: dailyDependencies(), env: loadEnv(), now: () => Date.now() };
}
