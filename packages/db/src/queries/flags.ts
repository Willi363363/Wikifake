// A player's report, in a table rather than in a file.
//
// `complaints.jsonl` lives on Render's ephemeral disk, so every redeployment
// throws away every report the game has ever received — and the reports are the
// only signal the game has about the quality of its own articles. Nothing reads
// the file either: there is no triage queue, because there is nothing to query.
import { and, eq } from 'drizzle-orm';

import type { Database } from '../client.js';
import { flagReport } from '../schema/audit.js';

type Db = Database['db'];

/** A report and the verdict that was reached on it. Written together. */
export interface NewFlagReport {
  /** Null when the report does not name a game — a shared link, say. */
  readonly gameId?: string | null;
  /** Null for a reporter with no account, which most of them are. */
  readonly reporterId?: string | null;
  readonly articleTitle: string;
  readonly articleUrl: string;
  readonly flaggedClaim: string;
  readonly proposedCorrection: string;
  readonly quickNote: string;
  readonly explanation: string;
  readonly sources: readonly string[];
  readonly status: 'ai_reviewed' | 'pending_human_review' | 'rejected_by_ai';
  readonly verdict: 'likely_valid' | 'uncertain' | 'unsupported';
  readonly confidence: number;
  readonly reasoning: string;
  readonly sourcesFound: readonly string[];
  readonly recommendation: 'approve_for_review' | 'needs_more_info' | 'reject';
}

/**
 * Records a report and its verdict, and returns the identifier.
 *
 * One row rather than two: a report whose assessment lives somewhere else is a
 * report nobody can triage, which is the state the JSONL file leaves them in.
 */
export async function insertFlagReport(db: Db, report: NewFlagReport): Promise<string> {
  const [written] = await db
    .insert(flagReport)
    .values({
      ...report,
      gameId: report.gameId ?? null,
      reporterId: report.reporterId ?? null,
      sources: [...report.sources],
      sourcesFound: [...report.sourcesFound],
    })
    .returning({ id: flagReport.id });

  if (written === undefined) throw new Error('insertFlagReport: nothing was written');
  return written.id;
}

/** One report, by identifier. What a triage view opens. */
export function selectFlagReport(db: Db, id: string) {
  return db.select().from(flagReport).where(eq(flagReport.id, id));
}

/**
 * Reports about one article, at a given status.
 *
 * The query a triage view opens with, and the thing `complaints.jsonl` cannot
 * answer at all: a repeated complaint about the same article is the strongest
 * signal there is, and it is invisible in an append-only file nobody reads.
 */
export function selectFlagReportsFor(
  db: Db,
  articleTitle: string,
  status: NewFlagReport['status'],
) {
  return db
    .select({ id: flagReport.id, flaggedClaim: flagReport.flaggedClaim })
    .from(flagReport)
    .where(and(eq(flagReport.articleTitle, articleTitle), eq(flagReport.status, status)));
}
