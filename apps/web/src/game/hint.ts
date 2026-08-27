// C1.4 — `POST /api/game/hint`: billed on call, monotonic, billed once.
//
// The ledger is not held anywhere between requests. It is rebuilt from the
// `hint_purchase` rows every time, which is the whole difference from the
// current server: its ledger is a dictionary in a process, so a restart hands
// the player back every hint they paid for, free.
//
// The rules are `@wikifake/domain`'s and are not restated here. What this file
// does is read the record, ask, and write down what was charged.
import { ledgerFrom, grantHint, hintPenaltyFor, type HintLedger } from '@wikifake/domain';
import {
  recordHintPurchase,
  selectHintFor,
  selectHintPurchases,
  type Database,
} from '@wikifake/db';
import { decode, gameApi, restError } from '@wikifake/protocol';

import { BAD_REQUEST, refuse } from './errors.js';
import { openRound, REFUSED, type SessionContext } from './session.js';
import { json } from '../respond.js';
import { readJson } from './body.js';

type Db = Database['db'];

/** The ledger this participant has paid for, as the rows add up to it. */
async function ledgerOf(db: Db, participantId: string): Promise<HintLedger> {
  return ledgerFrom(await selectHintPurchases(db, participantId));
}

export async function handleHint(
  context: SessionContext,
  request: Request,
): Promise<Response> {
  const parsed = decode(gameApi.hintRequest, await readJson(request));
  if (!parsed.ok) {
    return json(
      restError,
      { code: 'bad_json', message: parsed.issues.join('; ') },
      { status: BAD_REQUEST },
    );
  }

  const access = await openRound(context, parsed.value.sessionId, request);
  if (!access.ok) return refuse(access.code, access.message);
  // A round that is over is a session that is over, and answers as one: nothing
  // may be bought or revealed after the debrief.
  if (access.round.endedAt !== null) return refuse(REFUSED.code, REFUSED.message);

  const { gameId, participantId } = access.round;

  // One position, the one asked for: the narrow read of `queries/session.ts`, so
  // a hint request cannot load the rest of the solution even by accident. An
  // empty result is a number this round does not have, and `grantHint` is what
  // says so — the refusal is a rule, not a null check written twice.
  const position = await selectHintFor(context.db, gameId, parsed.value.falseInfoNumber);

  const grant = grantHint(position, await ledgerOf(context.db, participantId), {
    falseInfoNumber: parsed.value.falseInfoNumber,
    level: parsed.value.level,
    // C1.5 — nothing can block a hint in solo: `HINT_LOCK` is cast by a rival,
    // and there is none. The guard arrives with the multiplayer transport in
    // phase 5, which is where a rival exists to cast it.
  });

  if (!grant.ok) return refuse(grant.code, 'That hint is not available.');

  let payload = grant.payload;

  if (payload.charged > 0) {
    const billed = await recordHintPurchase(context.db, {
      participantId,
      falseInfoNumber: payload.falseInfoNumber,
      level: payload.grant.level,
      charged: payload.charged,
    });

    // The level was already billed — two requests read the same ledger and both
    // decided to charge. The player owns it, so they are served it, for free,
    // and the penalty is recomputed from the record that actually landed rather
    // than from the one this request had imagined.
    if (!billed) {
      const ledger = await ledgerOf(context.db, participantId);
      payload = { ...payload, charged: 0, hintPenalty: hintPenaltyFor(ledger) };
    }
  }

  return json(gameApi.hintResponse, payload);
}
