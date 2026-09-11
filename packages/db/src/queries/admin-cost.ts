// What the model has cost — step I.6.
//
// **`llm_call` records tokens, and tokens are a measurement.** Money is a
// multiplication a deployment opts into, because a rate written into the
// repository would be wrong within a quarter and silent about it. What lives
// here is the counting.
//
// C4.6's insistence carries through every figure: **a cached game costs
// nothing, and averaging it in makes generation look cheaper than it is.** So
// the per-game denominator is games actually generated, not games served.
import { eq, gte, sql } from 'drizzle-orm';

import type { Database } from '../client.js';
import { game, participant } from '../schema/game.js';
import { llmCall } from '../schema/usage.js';

type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type Db = Database['db'] | Tx;

/** One day's model usage. `day` is a UTC date, as `YYYY-MM-DD`. */
export interface DayUsage {
  readonly day: string;
  readonly calls: number;
  readonly failed: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/**
 * Model usage per day, most recent last — a series a chart could read.
 *
 * UTC days, the same ones `periodIndexOf` uses, so a spike on this section and
 * a spike on the players section are the same day.
 *
 * **A failed call still costs**, which is why `failed` is counted beside the
 * others rather than filtered out: the tokens went to the model either way, and
 * a cost report that hid them would understate exactly the spend worth cutting.
 */
export async function usageByDay(db: Db, sinceMs: number): Promise<readonly DayUsage[]> {
  return (
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${llmCall.createdAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
        calls: sql<number>`count(*)::int`,
        failed: sql<number>`count(*) filter (where ${llmCall.failed})::int`,
        inputTokens: sql<number>`coalesce(sum(${llmCall.inputTokens}), 0)::int`,
        outputTokens: sql<number>`coalesce(sum(${llmCall.outputTokens}), 0)::int`,
      })
      .from(llmCall)
      // `gte` and not a raw template: `sql\`… >= ${new Date(…)}\`` binds the
      // instant as a parameter with no type behind it, and postgres.js refuses a
      // `Date` there. Drizzle knows the column and encodes it.
      .where(gte(llmCall.createdAt, new Date(sinceMs)))
      .groupBy(sql`date_trunc('day', ${llmCall.createdAt} at time zone 'UTC')`)
      .orderBy(sql`date_trunc('day', ${llmCall.createdAt} at time zone 'UTC')`)
  );
}

export interface CostTotals {
  readonly calls: number;
  readonly failed: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /**
   * Calls that reported no token count at all.
   *
   * `input_tokens` is nullable because the model does not always say, and
   * `sum` skips a null — so a total built from a provider that stopped
   * reporting would fall while the spend rose. Counted, so the panel can say
   * *these figures are missing N calls* rather than quietly understating.
   */
  readonly withoutTokens: number;
  /** Games actually generated: C4.6's denominator, not games served. */
  readonly gamesGenerated: number;
  /** Distinct accounts and guests who took a seat in any round. */
  readonly players: number;
}

/** Every total the section divides by, in one pass each. */
export async function selectCostTotals(db: Db): Promise<CostTotals> {
  const [usage] = await db
    .select({
      calls: sql<number>`count(*)::int`,
      failed: sql<number>`count(*) filter (where ${llmCall.failed})::int`,
      inputTokens: sql<number>`coalesce(sum(${llmCall.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${llmCall.outputTokens}), 0)::int`,
      withoutTokens: sql<number>`count(*) filter (where ${llmCall.inputTokens} is null)::int`,
    })
    .from(llmCall);

  const [generated] = await db
    .select({ games: sql<number>`count(*)::int` })
    .from(game)
    .where(eq(game.fromCache, false));

  // Guests included, and counted by their `participant` row rather than by an
  // account: the model was called for their round too, so leaving them out
  // would divide a real cost by a smaller population and flatter the figure.
  const [played] = await db
    .select({
      players: sql<number>`count(distinct coalesce(${participant.userId}, ${participant.id}::text))::int`,
    })
    .from(participant);

  return {
    calls: usage?.calls ?? 0,
    failed: usage?.failed ?? 0,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    withoutTokens: usage?.withoutTokens ?? 0,
    gamesGenerated: generated?.games ?? 0,
    players: played?.players ?? 0,
  };
}

/**
 * Model usage by kind, so the expensive half of a round is visible.
 *
 * Ordered by the enum, which Postgres sorts in **declaration order** rather
 * than alphabetically — and that is the order worth having: `topic_choice`,
 * `falsification`, `flag_verification` is the order a round actually calls
 * them. Alphabetical would put the verification of a player's report before the
 * falsification it is about.
 */
export interface KindUsage {
  readonly kind: string;
  readonly calls: number;
  readonly failed: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export async function usageByKind(db: Db): Promise<readonly KindUsage[]> {
  return db
    .select({
      kind: llmCall.kind,
      calls: sql<number>`count(*)::int`,
      failed: sql<number>`count(*) filter (where ${llmCall.failed})::int`,
      inputTokens: sql<number>`coalesce(sum(${llmCall.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${llmCall.outputTokens}), 0)::int`,
    })
    .from(llmCall)
    .groupBy(llmCall.kind)
    .orderBy(llmCall.kind);
}
