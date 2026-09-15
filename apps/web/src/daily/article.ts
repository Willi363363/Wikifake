// The day's article, on demand — step N.3.
//
// **The read path is the guarantee and the cron is the optimisation**, inherited
// whole from F.5 because the same argument holds: a day whose schedule never ran
// must still have an article for whoever asks first. Stop the cron for a week and
// the game is unchanged; what is lost is the wait on the first request of each
// day.
//
// The shape is N.1's claim turned into a sentence:
//
//   1. the day has an article  → serve it, which is every request but the first;
//   2. nobody has claimed it   → claim it and generate;
//   3. somebody else claimed it→ say so, and do not generate a second one.
//
// **Three is not a failure**, and calling it one is the mistake this file exists
// to avoid: fifty players arriving at midnight would each read "no article" and,
// if the caller retried, each buy one.
import {
  claimDay,
  fillDay,
  recordLlmCalls,
  releaseClaim,
  selectDay,
  type DailyArticle,
  type Database,
} from '@wikifake/db';
import {
  chooseDailyArticle,
  generateArticle,
  type WikiRequest,
  type WikiTransport,
} from '@wikifake/article';
import { periodIndexOf } from '@wikifake/domain';
import type { LanguageModel } from 'ai';

export interface DailyDependencies {
  readonly db: Database['db'];
  readonly model: LanguageModel;
  readonly wiki: WikiRequest;
  readonly transport: WikiTransport;
  /** Which paragraphs get falsified. A parameter, so a test pins the draw. */
  seed(): number;
}

/**
 * How many titles the day asks for, and how many it will fetch.
 *
 * Wide list, short fetch: a rejected candidate costs one Wikipedia request, and
 * `attempts` is what stops a bad day from spending twenty of them while somebody
 * waits for a round.
 */
export const DAILY_CANDIDATES = 40;
export const DAILY_ATTEMPTS = 6;

export type DailyOutcome =
  | { readonly status: 'ready'; readonly article: DailyArticle }
  /** Somebody else holds the claim. Not an error: ask again in a moment. */
  | { readonly status: 'generating' }
  /** Nothing could be made today, and the claim has been given back. */
  | { readonly status: 'unavailable'; readonly reason: string };

/**
 * The article for the day containing `atMs`, generating it if nobody has.
 *
 * **Every model call is recorded on both paths**, which is C4.5's rule and the
 * reason this does not simply return on failure: a generation that bought
 * nothing was still billed, and dropping the record is what makes the cost of
 * failure invisible. They are recorded against no game, because there is none —
 * the day's article is not a round until somebody plays it, which is N.4.
 */
export async function ensureDailyArticle(
  dependencies: DailyDependencies,
  atMs: number,
): Promise<DailyOutcome> {
  const day = periodIndexOf('daily', atMs);

  const existing = await selectDay(dependencies.db, day);
  if (existing !== null) return { status: 'ready', article: existing };

  const at = new Date(atMs);
  if (!(await claimDay(dependencies.db, day, at))) {
    // Either somebody is generating it right now, or they finished between the
    // read above and this line. Re-reading covers the second, and costs one
    // query on the rarest path there is.
    const settled = await selectDay(dependencies.db, day);
    return settled === null
      ? { status: 'generating' }
      : { status: 'ready', article: settled };
  }

  return generateFor(dependencies, day, at);
}

/** The claim is held on entry, and released on every path that does not fill it. */
async function generateFor(
  dependencies: DailyDependencies,
  day: number,
  at: Date,
): Promise<DailyOutcome> {
  const chosen = await chooseDailyArticle(
    { wiki: dependencies.wiki, transport: dependencies.transport },
    { candidates: DAILY_CANDIDATES, attempts: DAILY_ATTEMPTS },
  );

  if (!chosen.ok) {
    await releaseClaim(dependencies.db, day);
    return { status: 'unavailable', reason: chosen.reason };
  }

  const report = await generateArticle({
    html: chosen.value.page.html,
    topic: chosen.value.page.title,
    sourceUrl: chosen.value.page.url,
    model: dependencies.model,
    seed: dependencies.seed(),
  });

  await recordLlmCalls(dependencies.db, report.calls, null);

  if (!report.result.ok) {
    await releaseClaim(dependencies.db, day);
    return { status: 'unavailable', reason: report.result.reason };
  }

  const { article, solution } = report.result.value;

  await fillDay(
    dependencies.db,
    day,
    {
      topic: article.topic,
      sourceUrl: article.wikipediaUrl,
      paragraphs: article.paragraphs,
      solution,
      totalFakes: article.totalFakes,
    },
    at,
  );

  // Read back rather than assembled from what was just written. `fillDay` can
  // answer false — a claim released and retaken between the two — and a caller
  // handed the article it generated would then be reading one nobody else can
  // see. The row is the answer; this function only fills it.
  const stored = await selectDay(dependencies.db, day);

  return stored === null
    ? { status: 'generating' }
    : { status: 'ready', article: stored };
}
