// C1.2, C1.3 — `POST /api/game/submit`: the server grades, and only then does
// the solution leave.
//
// Every number in the breakdown comes from server state. That is not a policy
// applied here, it is the shape of the request: `submitRequest` carries a
// session handle and a list of marked paragraphs, and has no field for
// `hintsUsed`, `hintPenalty` or `scoreStolen`. A client cannot declare a
// penalty because there is nowhere to write one — which is stronger than
// ignoring it, and is why the test for C1.3 has to send those fields as extra
// keys and watch them disappear.
//
// The grading and the scale are `@wikifake/domain`'s. The current codebase keeps
// the scale in `backend/src/scoring.py` *and* in `frontend/src/config.js`, which
// is the duplication the rewrite exists to close.
import {
  gradeAnswer,
  gradeSubmission,
  hintPenaltyFor,
  hintsUsedFor,
  ledgerFrom,
} from '@wikifake/domain';
import {
  recordSubmission,
  selectHintPurchases,
  selectLeaderboard,
  selectSolution,
  type Database,
} from '@wikifake/db';
import { decode, gameApi, restError, type ScoreBreakdown } from '@wikifake/protocol';

import { BAD_REQUEST, refuse } from './errors.js';
import { openRound, REFUSED, type SessionContext } from './session.js';
import { json } from '../respond.js';
import { readJson } from './body.js';

type Db = Database['db'];

export interface SubmitContext extends SessionContext {
  /** Injected: the rules take the clock as a parameter, and so does the record. */
  readonly now: () => Date;
}

/** How long the round has been running, in whole seconds. */
function elapsedSeconds(startedAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
}

/**
 * The breakdown already stored for a participant who has submitted.
 *
 * Read back rather than recomputed: a second submission arriving a minute later
 * would grade against a different clock and quietly replace the score with a
 * smaller one. The debrief a player was shown is the debrief they keep.
 */
async function storedResult(
  db: Db,
  gameId: string,
  participantId: string,
): Promise<{ score: number; breakdown: ScoreBreakdown } | null> {
  const row = (await selectLeaderboard(db, gameId)).find(
    (entry) => entry.id === participantId,
  );
  if (row === undefined || row.score === null) return null;

  return {
    score: row.score,
    breakdown: {
      truePositives: row.truePositives ?? 0,
      falsePositives: row.falsePositives ?? 0,
      hintsUsed: row.hintsUsed ?? 0,
      hintPenalty: row.hintPenalty ?? 0,
      scoreStolen: row.scoreStolen ?? 0,
      timeBonus: row.timeBonus ?? 0,
    },
  };
}

export async function handleSubmit(
  context: SubmitContext,
  request: Request,
): Promise<Response> {
  const parsed = decode(gameApi.submitRequest, await readJson(request));
  if (!parsed.ok) {
    return json(
      restError,
      { code: 'bad_json', message: parsed.issues.join('; ') },
      { status: BAD_REQUEST },
    );
  }

  const access = await openRound(context, parsed.value.sessionId, request);
  if (!access.ok) return refuse(access.code, access.message);

  const { gameId, participantId } = access.round;

  // C1.2 — the round is over for this player either way, so the solution is
  // theirs. Read once, below, and never on any other path.
  const answer = async (result: {
    score: number;
    breakdown: ScoreBreakdown;
  }): Promise<Response> =>
    json(gameApi.submitResponse, {
      ...result,
      solution: await selectSolution(context.db, gameId),
    });

  // Already graded: hand back what was decided then. A retried request — a lost
  // response, a double-click — must not be a second grading.
  if (access.round.submittedAt !== null) {
    const stored = await storedResult(context.db, gameId, participantId);
    return stored === null ? refuse(REFUSED.code, REFUSED.message) : answer(stored);
  }

  const solution = await selectSolution(context.db, gameId);
  const grading = gradeAnswer(solution, parsed.value.marked);
  const ledger = ledgerFrom(await selectHintPurchases(context.db, participantId));
  const at = context.now();

  const graded = gradeSubmission({
    truePositives: grading.found.length,
    falsePositives: grading.wrong.length,
    // C1.3 — from the ledger the database holds, not from anything sent.
    hintsUsed: hintsUsedFor(ledger),
    hintPenalty: hintPenaltyFor(ledger),
    // C1.5 — nothing can steal points in solo: `SCORE_STEAL` is cast by a rival,
    // and there is none. It arrives with the multiplayer transport in phase 5.
    scoreStolen: 0,
    timeLimitSeconds: access.round.timeLimit,
    elapsedSeconds: elapsedSeconds(access.round.startedAt, at),
  });

  const settled = await recordSubmission(context.db, {
    gameId,
    participantId,
    marked: parsed.value.marked,
    score: graded.score,
    ...graded.breakdown,
    at,
  });

  // Another request graded it first. Theirs is the grading that counts.
  if (!settled) {
    const stored = await storedResult(context.db, gameId, participantId);
    return stored === null ? refuse(REFUSED.code, REFUSED.message) : answer(stored);
  }

  return answer(graded);
}
