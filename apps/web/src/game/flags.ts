// `POST /api/flag-report`: a player reports a genuine error, and it is kept.
//
// The report replaces `complaints.jsonl`, which lives on an ephemeral disk: every
// redeployment throws away every report the game has ever received. Nothing reads
// the file either, so there is no triage queue — there is nothing to query. A
// row fixes both at once.
//
// The check itself is `@wikifake/article`'s, which is where the MediaWiki client
// and the schema-validated model call already live. What this file decides is
// what the verdict means for the report's status, and who the reporter is.
import { verifyFlag, type WikiRequest, type WikiTransport } from '@wikifake/article';
import { insertFlagReport, recordLlmCalls, type Database } from '@wikifake/db';
import { decode, flagsApi, restError } from '@wikifake/protocol';
import type { LanguageModel } from 'ai';

import type { auth } from '../auth/auth.js';
import { BAD_REQUEST } from './errors.js';
import { json } from '../respond.js';
import { readJson } from './body.js';

export interface FlagsContext {
  readonly auth: ReturnType<typeof auth>;
  readonly db: Database['db'];
  readonly model: LanguageModel;
  readonly wiki: WikiRequest;
  readonly transport: WikiTransport;
}

/**
 * Where the verdict puts the report, carried over from `verify_and_save`.
 *
 * `ai_reviewed` is the middle: checked, and neither promoted nor rejected. The
 * mapping is a `Record` rather than an `if/else if` so a fourth recommendation
 * fails to compile instead of falling silently into the middle.
 */
const STATUS: Readonly<
  Record<flagsApi.FlagVerification['recommendation'], flagsApi.FlagStatus>
> = {
  approve_for_review: 'pending_human_review',
  reject: 'rejected_by_ai',
  needs_more_info: 'ai_reviewed',
};

export async function handleFlagReport(
  context: FlagsContext,
  request: Request,
): Promise<Response> {
  const parsed = decode(flagsApi.flagReportRequest, await readJson(request));
  if (!parsed.ok) {
    return json(
      restError,
      { code: 'bad_json', message: parsed.issues.join('; ') },
      { status: BAD_REQUEST },
    );
  }
  const report = parsed.value;

  // Who reported it comes from the session, not from the payload. The contract's
  // `playerId` was written for a client that had no accounts and can be anything
  // the browser types; a report attributed to whoever the reporter claimed to be
  // is a report that can be attributed to somebody else.
  const session = await context.auth.api.getSession({ headers: request.headers });

  const checked = await verifyFlag({
    model: context.model,
    articleTitle: report.articleTitle,
    flaggedClaim: report.flaggedClaim,
    proposedCorrection: report.proposedCorrection,
    explanation: report.explanation,
    sources: report.sources,
    wiki: context.wiki,
    transport: context.transport,
  });

  const id = await insertFlagReport(context.db, {
    // The request names a **room**, and a room plays many rounds: there is no
    // field in it that names the game a claim was read in. Left null rather than
    // guessed — a report filed against the wrong round is worse than one filed
    // against none.
    gameId: null,
    reporterId: session?.user.id ?? null,
    articleTitle: report.articleTitle,
    articleUrl: report.articleUrl,
    flaggedClaim: report.flaggedClaim,
    proposedCorrection: report.proposedCorrection,
    quickNote: report.quickNote,
    explanation: report.explanation,
    sources: report.sources,
    status: STATUS[checked.verification.recommendation],
    ...checked.verification,
  });

  // D12 — the call is recorded whether or not it worked, and with no game to
  // attach it to. `flag_verifier.py` records nothing at all, so `/api/usage`
  // under-reports the spend by however many reports came in.
  if (checked.call !== null) await recordLlmCalls(context.db, [checked.call], null);

  return json(flagsApi.flagReportResponse, {
    id,
    status: STATUS[checked.verification.recommendation],
    verification: checked.verification,
  });
}
