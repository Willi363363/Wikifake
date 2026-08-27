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
} from '@wikifake/protocol';

import type { auth } from '../auth/auth.js';
import { readJson } from './body.js';
import { BAD_REQUEST, statusFor } from './errors.js';
import { identify } from './player.js';
import { startRound, type RoundDependencies } from './round.js';
import { json } from '../respond.js';

export interface StartContext {
  readonly auth: ReturnType<typeof auth>;
  readonly round: RoundDependencies;
}

export async function handleStart(
  context: StartContext,
  request: Request,
): Promise<Response> {
  const parsed = decode(gameApi.startGameRequest, await readJson(request));
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
      { status: statusFor(outcome.code), setCookies },
    );
  }

  return json(gameApi.startGameResponse, outcome.value, { setCookies });
}
