// `POST /api/quests/claim` — step F.6.
//
// The one thing a player does to a quest, and the only place in track F where
// getting it wrong hands somebody unlimited coins.
//
// **Nothing is credited, because there is no wallet.** Track H owns the
// balance, and F.6 was re-cut to deliver the once-only marking and the
// transaction boundary a credit will slot into. `claimQuest` already takes a
// transaction, so when H arrives the credit goes inside the same one and
// neither happens without the other.
//
// The ordering here is read, judge, then claim — and the claim is the only step
// that is atomic. That is deliberate and it is safe in one direction only: two
// requests that both see *complete* race at the update, and one loses. A claim
// refused to somebody who had earned it is recoverable by clicking again; a
// reward paid twice is not.
import { claimQuest, selectQuestById, selectRoundsInWindow } from '@wikifake/db';
import {
  isQuestComplete,
  periodWindowOf,
  progressFor,
  QUEST_CATALOGUE,
  type QuestRuleId,
} from '@wikifake/domain';
import { questsApi, decode } from '@wikifake/protocol';

import type { auth } from '../auth/auth.js';
import { readJson } from '../game/body.js';
import { refuse } from '../game/errors.js';
import { json } from '../respond.js';
import type { QuestsContext } from './sets.js';

export interface ClaimContext extends QuestsContext {
  readonly auth: ReturnType<typeof auth>;
  /** The clock, as a parameter, so a test decides when a claim happened. */
  now(): Date;
}

export async function handleClaimQuest(
  context: ClaimContext,
  request: Request,
): Promise<Response> {
  const parsed = decode(questsApi.claimQuestRequest, await readJson(request));
  // `bad_json` rather than a quest code: a body that is not a well-formed
  // identifier is not a claim about any quest, so it cannot be *this* quest's
  // problem.
  if (!parsed.ok) return refuse('bad_json', parsed.issues.join('; '));

  const session = await context.auth.api.getSession({ headers: request.headers });
  // A guest holds a real `user` row, so `isAnonymous` is not checked here: a
  // guest simply has no quests, and `selectQuestById` says so as `not_found`.
  // Nothing is created on this path — unlike `/api/game/start`, a claim on a
  // quest that does not exist is not an invitation to mint an identity.
  if (session === null) return refuse('quest_not_found', 'No quest to claim.');

  const quest = await selectQuestById(context.db, session.user.id, parsed.value.questId);
  // Absent and somebody else's are the same answer, on purpose: distinguishing
  // them would confirm the existence of a row to whoever guessed at it.
  if (quest === null) return refuse('quest_not_found', 'No quest to claim.');

  // A short-circuit, and **not** the guarantee — worth saying because it looks
  // like one. `claimQuest` refuses an already-claimed quest by itself, with the
  // same code, so removing this check changes nothing a caller can observe: a
  // mutation deleting it passes every test in `claim.test.ts`, correctly. What
  // it buys is the window query below, skipped for a quest there is nothing left
  // to pay on.
  if (quest.claimedAt !== null) {
    return refuse('quest_already_claimed', 'That reward has already been taken.');
  }

  const rule = QUEST_CATALOGUE[quest.ruleId as QuestRuleId];
  // A rule the catalogue no longer knows. `sets.ts` drops such a row from the
  // list, so a player cannot reach this through the screen — but an identifier
  // kept from an earlier session can, and there is no reward to pay for a rule
  // that no longer exists.
  if (rule === undefined) return refuse('quest_not_found', 'No quest to claim.');

  const window = periodWindowOf(rule.period, quest.periodIndex);
  const rounds = await selectRoundsInWindow(
    context.db,
    session.user.id,
    window.fromMs,
    window.toMs,
  );

  const progress = progressFor(rule, rounds);
  if (!isQuestComplete(quest.target, progress)) {
    return refuse('quest_not_complete', 'That quest is not finished yet.');
  }

  const claim = await claimQuest(context.db, session.user.id, quest.id, context.now());
  if (!claim.ok) {
    // The race, arriving. `already_claimed` is the interesting one — two
    // requests both judged the quest complete and this is the loser — and
    // `not_found` cannot happen after the read above unless the account was
    // deleted mid-request, which is its own answer.
    return claim.reason === 'already_claimed'
      ? refuse('quest_already_claimed', 'That reward has already been taken.')
      : refuse('quest_not_found', 'No quest to claim.');
  }

  return json(questsApi.claimQuestResponse, {
    questId: claim.quest.id,
    ruleId: rule.id,
    // From the catalogue, never from the row — F.3's asymmetry, and the figure
    // a player is told they earned is the one the server decided.
    reward: rule.reward,
    claimedAt: (claim.quest.claimedAt as Date).toISOString(),
  });
}
