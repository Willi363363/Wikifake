// C1.4 — `POST /api/game/hint`: billed on call, monotonic, billed once.
//
// The ledger is not held anywhere between requests. It is rebuilt from the
// `hint_purchase` rows every time, which is the whole difference from the
// current server: its ledger is a dictionary in a process, so a restart hands
// the player back every hint they paid for, free.
//
// The rules are `@wikifake/domain`'s and are not restated here. What this file
// does is read the record, ask, and write down what was charged.
import {
  ledgerFrom,
  grantHint,
  hintCoinCostFor,
  hintPenaltyPaid,
  type HintLedger,
} from '@wikifake/domain';
import {
  recordHintPurchase,
  recordMovement,
  selectBalance,
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

/**
 * The record this participant has built up: what they hold, and what it took.
 *
 * Both from the same read, because since H.4 they are two different facts and
 * asking twice would be two round trips for one set of rows. The ledger prices
 * *what is owned* and cannot answer *what was paid* — it throws the amounts
 * away by design — so the penalty comes from the rows.
 */
async function recordOf(
  db: Db,
  participantId: string,
): Promise<{ ledger: HintLedger; penalty: number }> {
  const purchases = await selectHintPurchases(db, participantId);
  return { ledger: ledgerFrom(purchases), penalty: hintPenaltyPaid(purchases) };
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

  const record = await recordOf(context.db, participantId);

  const grant = grantHint(position, record.ledger, {
    falseInfoNumber: parsed.value.falseInfoNumber,
    level: parsed.value.level,
    // C1.5 — nothing can block a hint in solo: `HINT_LOCK` is cast by a rival,
    // and there is none. The guard arrives with the multiplayer transport in
    // phase 5, which is where a rival exists to cast it.
  });

  if (!grant.ok) return refuse(grant.code, 'That hint is not available.');

  /*
   * H.4 — the penalty is this handler's to state, not the grant's.
   *
   * `grantHint` prices the ledger, which is right everywhere it is the only
   * record — the room holds nothing else. Here the rows also say *which
   * currency*, and a level the coins paid for is in the ledger while having
   * charged the score nothing. So the answer is what was charged before this
   * request plus what this one charges, which is zero on both the paths that
   * charge nothing: a level already owned, and a level bought with coins.
   */
  let payload = { ...grant.payload, hintPenalty: record.penalty + grant.payload.charged };

  /*
   * Step H.4 — coins instead of score, and **solo only**.
   *
   * A room round is ranked, and paying with coins leaves the score untouched —
   * so a player with coins would outscore one without on the boards G.5 just
   * spent a step keeping honest. Refusing here is the constraint held by
   * construction rather than by watching for it.
   *
   * The rest of the mechanic is untouched, which is what the track asked for:
   * the hint is granted by the same rules and recorded in the same table. What
   * changed is one word in the penalty's definition — it is the sum of what the
   * score was *charged*, not the price of what is *held* — and that is the whole
   * reason a coin-paid hint costs no score. Deriving it from the levels held
   * would have taken the coins and the score both.
   */
  const payingCoins = parsed.value.pay === 'coins' && payload.charged > 0;

  if (payingCoins && access.round.mode !== 'solo') {
    return refuse('coins_not_accepted', 'A hint in a room is paid for with score.');
  }

  if (payingCoins) {
    const price = hintCoinCostFor(payload.grant.level);
    const balance = await selectBalance(context.db, access.userId);

    // Checked before the write and refused with a sentence, which is why H.1
    // deliberately has no constraint against a negative balance: an overdraft
    // as a database error is an overdraft nobody can explain to a player.
    if (balance < price) {
      return refuse('insufficient_coins', 'Not enough coins for that hint.');
    }

    // Both or neither. A debit without the purchase is a coin taken for
    // nothing; a purchase without the debit is a free hint.
    const paid = await context.db.transaction(async (tx) => {
      const billed = await recordHintPurchase(tx, {
        participantId,
        falseInfoNumber: payload.falseInfoNumber,
        level: payload.grant.level,
        // Nothing charged to the score: the coins are the price, and the row
        // says which currency so that `charged: 0` is a fact rather than a hole.
        charged: 0,
        paidWith: 'coins',
      });
      if (!billed) return false;

      await recordMovement(tx, {
        userId: access.userId,
        amount: -price,
        source: 'hint_purchase',
        reference: `${gameId}:${String(payload.falseInfoNumber)}`,
        idempotencyKey: `hint:${participantId}:${String(payload.falseInfoNumber)}:${String(payload.grant.level)}`,
      });

      return true;
    });

    // `charged: 0` either way, and the penalty recomputed from the record that
    // actually landed. `paid` is false when the level was already owned — two
    // requests read the same ledger and both decided to charge — and the answer
    // is the same in both cases: the player has the hint and their score is
    // untouched. The debit did not happen twice, because the key is the level.
    void paid;
    return json(gameApi.hintResponse, {
      ...payload,
      charged: 0,
      hintPenalty: record.penalty,
    });
  }

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
      const { penalty } = await recordOf(context.db, participantId);
      payload = { ...payload, charged: 0, hintPenalty: penalty };
    }
  }

  return json(gameApi.hintResponse, payload);
}
