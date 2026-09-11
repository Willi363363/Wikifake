// `POST /api/account/region` — step G.1.
//
// The one thing that writes `chosen_region`, and the reason the column exists:
// a region derived from a header is an inference, and the track's answer to
// anybody who objects to it is that they can set their own and theirs counts.
//
// **The header is read where the row is created, not here.** This handler only
// records a choice. That split is what keeps the inference from following a
// travelling player around: `claimPseudonym` writes the derived value once, and
// nothing rewrites it.
import { setChosenRegion, type Database } from '@wikifake/db';
import { accountApi, decode } from '@wikifake/protocol';

import type { auth } from '../auth/auth.js';
import { readJson } from '../game/body.js';
import { refuse } from '../game/errors.js';
import { json } from '../respond.js';

export interface RegionContext {
  readonly auth: ReturnType<typeof auth>;
  readonly db: Database['db'];
}

/**
 * The country code the CDN put on the request.
 *
 * `x-vercel-ip-country` is the platform's, and it is absent locally and in
 * tests — which is the ordinary case rather than a failure: `regionForCountry`
 * answers `other` for anything it cannot place, so a deployment behind a
 * different CDN, or none, still ranks everybody somewhere.
 *
 * Never trusted from a browser. It is a request header like any other, so a
 * client can send it — and it is read only on the server, only to *derive* a
 * default that the player can overrule, and it decides nothing else. A player
 * who forges it has chosen their own board, which is a thing they may do
 * through this handler anyway.
 */
export function countryOf(request: Request): string | null {
  return request.headers.get('x-vercel-ip-country');
}

export async function handleChooseRegion(
  context: RegionContext,
  request: Request,
): Promise<Response> {
  const parsed = decode(accountApi.chooseRegionRequest, await readJson(request));
  // The closed list is the protocol's, so a region nobody offers is refused
  // before it reaches a column that has no enum behind it.
  if (!parsed.ok) return refuse('bad_json', parsed.issues.join('; '));

  const session = await context.auth.api.getSession({ headers: request.headers });
  // A guest and a stranger get the identical refusal, which is E.3.2's rule for
  // the pseudonym and holds for the same reason: neither has an account to rank,
  // and a client cannot act on the difference.
  if (session === null || session.user.isAnonymous === true) {
    return refuse('session_not_found', 'Sign up before choosing a region.');
  }

  const recorded = await setChosenRegion(
    context.db,
    session.user.id,
    parsed.value.region,
  );
  // No row means no pseudonym, and E.3.2's gate sends that account to choose
  // one before it reaches anything else.
  if (!recorded) return refuse('session_not_found', 'Choose a pseudonym first.');

  return json(accountApi.chooseRegionResponse, { region: parsed.value.region });
}
