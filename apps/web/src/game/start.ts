// The handler behind `POST /api/game/start`, separated from its wiring.
//
// The route file builds a database connection, a Redis client and a model from
// the environment; this file takes them as arguments. That is what lets the
// negative assertion of C1.1 run against the **real** handler — its parsing, its
// identification, its encoder — with a frozen page and a mocked model, instead of
// against a payload a test built by hand and already knew the shape of.
import {
  decode,
  gameApi,
  restError,
  DEFAULT_TIME_LIMIT_SECONDS,
  type ErrorCode,
} from '@wikifake/protocol';

import type { auth } from '../auth/auth.js';
import { identify } from './player.js';
import { startRound, type RoundDependencies } from './round.js';
import { json } from '../respond.js';

const BAD_REQUEST = 400;

/**
 * How a failure answers.
 *
 * `topic_not_found` is a 404 about the topic, not about the route: the player
 * typed something with no article behind it, which is an ordinary outcome of
 * letting them type anything. `generation_failed` is a 502 because what failed is
 * upstream — Wikipedia or the model — and the difference is what tells a client
 * whether retrying the same topic is worth anything.
 */
const STATUS: Readonly<Partial<Record<ErrorCode, number>>> = {
  bad_json: BAD_REQUEST,
  topic_not_found: 404,
  generation_failed: 502,
};

export interface StartContext {
  readonly auth: ReturnType<typeof auth>;
  readonly round: RoundDependencies;
}

/** Whatever the request carried, or null if it was not JSON at all. */
async function body(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    // Told apart from a body the schema refuses only in the message: both mean
    // "this route cannot read what you sent".
    return null;
  }
}

export async function handleStart(
  context: StartContext,
  request: Request,
): Promise<Response> {
  const parsed = decode(gameApi.startGameRequest, await body(request));
  if (!parsed.ok) {
    return json(
      restError,
      { code: 'bad_json', message: parsed.issues.join('; ') },
      { status: BAD_REQUEST },
    );
  }

  // Before the article, deliberately: a guest identity created after a ten-second
  // generation is an identity created while the player is already waiting, and a
  // failure to mint one would waste the generation it followed.
  const { player, setCookies } = await identify(context.auth, request);

  const outcome = await startRound(context.round, {
    topic: parsed.value.topic,
    timeLimit: parsed.value.timeLimit ?? DEFAULT_TIME_LIMIT_SECONDS,
    player,
  });

  if (!outcome.ok) {
    return json(
      restError,
      { code: outcome.code, message: outcome.message },
      // The cookies travel on the failing path too: the guest identity exists
      // now, and dropping it here would make the retry a different player.
      { status: STATUS[outcome.code] ?? 500, setCookies },
    );
  }

  return json(gameApi.startGameResponse, outcome.value, { setCookies });
}
