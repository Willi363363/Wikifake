// `POST /api/account/pseudonym` — step E.3.2.
//
// The one place a `profile` row is created, and therefore the one place an
// account acquires the name other players see. Two screens call it, and they
// are the two ways an account can exist without a pseudonym: sign-up, which has
// just created the account, and `/choose-a-name`, which catches every account
// that arrived through Google and anybody whose sign-up claim lost a race.
//
// **One endpoint for both**, rather than a claim wired into sign-up and a
// second one for the rest. The screens differ in what they do afterwards, which
// is a screen's business; what "take this name if nobody has it" means is one
// thing, and a second implementation of it would be a second chance to get the
// refusal wrong.
//
// **A guest is refused rather than served.** A guest holds a real anonymous
// `user` row — 4.3's design, so their games follow them into an account — and
// giving that row a pseudonym would spend a name on an identity the anonymous
// plugin deletes the moment they sign up. The name would be held by nobody and
// released by nothing.
//
// This handler takes its collaborators as arguments, like every other one in
// `src/game/`, so a test drives the real code with its own database rather than
// a mock of it.
import { claimPseudonym, type Database } from '@wikifake/db';
import { regionForCountry } from '@wikifake/domain';
import { accountApi, decode } from '@wikifake/protocol';

import type { auth } from '../auth/auth.js';
// `game/errors.ts` is the application's error table rather than the game's —
// one status per code, for every REST route. It has never moved, and moving it
// for this step would be a rename in a diff that is about something else.
import { refuse } from '../game/errors.js';
import { readJson } from '../game/body.js';
import { countryOf } from './region.js';
import { json } from '../respond.js';

export interface ClaimContext {
  readonly auth: ReturnType<typeof auth>;
  readonly db: Database['db'];
}

export async function handleClaimPseudonym(
  context: ClaimContext,
  request: Request,
): Promise<Response> {
  const parsed = decode(accountApi.claimPseudonymRequest, await readJson(request));
  // `invalid_name` rather than `bad_json`: a body that is JSON and holds a
  // pseudonym the schema refuses is a name a player can fix, and the decoder's
  // own sentence says which rule it broke.
  if (!parsed.ok) return refuse('invalid_name', parsed.issues.join('; '));

  const session = await context.auth.api.getSession({ headers: request.headers });

  // No session and a guest session are the same refusal on purpose. Both mean
  // *there is no account here to name*, and the screens send them to the same
  // place — sign-up — so a client branching on the difference would be
  // branching on something it cannot act on differently.
  if (session === null || session.user.isAnonymous === true) {
    return refuse('session_not_found', 'Sign up before choosing a pseudonym.');
  }

  // G.1 — the row is created here, so this is where the derived region is
  // written. Once, with the insert: a profile that existed for a moment without
  // one would be a profile some query could read in that moment.
  const claim = await claimPseudonym(
    context.db,
    session.user.id,
    parsed.value.pseudonym,
    regionForCountry(countryOf(request)),
  );

  // Also the answer for an account that already has one: `claimPseudonym`
  // creates and never renames, so a second claim collides with the caller's own
  // row. Saying "taken" is true — it is, by them — and E.3 does not decide what
  // a rename costs a leaderboard.
  if (!claim.ok) {
    return refuse('pseudonym_taken', 'Another player already goes by that name.');
  }

  return json(accountApi.claimPseudonymResponse, {
    pseudonym: claim.pseudonym.displayName,
  });
}
