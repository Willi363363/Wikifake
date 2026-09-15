// The handler behind `POST /api/daily/start` — step N.7.
//
// The shape is `game/start.ts`'s and the differences are the whole of the file:
// there is no topic to read, and the two refusals it can answer are ordinary
// outcomes rather than errors — this account has already played today, or today
// has no article yet.
import {
  decode,
  gameApi,
  restError,
  DEFAULT_TIME_LIMIT_SECONDS,
} from '@wikifake/protocol';

import { startDailyRound, type DailyRoundDependencies } from './round.js';
import type { auth } from '../auth/auth.js';
import { readJson } from '../game/body.js';
import { BAD_REQUEST, statusFor } from '../game/errors.js';
import { identify } from '../game/player.js';
import { json } from '../respond.js';

export interface DailyStartContext {
  readonly auth: ReturnType<typeof auth>;
  readonly daily: DailyRoundDependencies;
  /** The clock, as a parameter, so a test can be on a Thursday. */
  now(): number;
}

export async function handleDailyStart(
  context: DailyStartContext,
  request: Request,
): Promise<Response> {
  const parsed = decode(gameApi.startDailyRequest, await readJson(request));
  if (!parsed.ok) {
    return json(
      restError,
      { code: 'bad_json', message: parsed.issues.join('; ') },
      { status: BAD_REQUEST },
    );
  }

  // Before the article, for `game/start.ts`'s reason: a guest identity minted
  // after a ten-second generation is one created while the player is already
  // waiting, and failing to mint it would waste the generation it followed.
  const { player, setCookies } = await identify(context.auth, request);

  const outcome = await startDailyRound(
    context.daily,
    { player, timeLimit: parsed.value.timeLimit ?? DEFAULT_TIME_LIMIT_SECONDS },
    context.now(),
  );

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
