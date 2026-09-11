// What the model has cost — step I.6.
//
// **Tokens are recorded; money is a multiplication a deployment opts into.**
// `MODEL_INPUT_COST_PER_MTOK` and its output twin are absent by default,
// because a rate written into the repository would be wrong within a quarter
// and would say nothing when it went stale. With neither, this section reports
// tokens and says why it cannot report money.
//
// That is not track H's forbidden *price in currency*: H.8's sweep is about the
// vocabulary of selling — providers, checkouts, a price on a thing a player
// buys. This is what the game pays a supplier, and no player ever sees it.
import {
  selectCostTotals,
  usageByDay,
  usageByKind,
  type CostTotals,
  type DayUsage,
  type Database,
  type KindUsage,
} from '@wikifake/db';
import { windowOf, type Range } from './range.js';

export interface CostContext {
  readonly db: Database['db'];
  /** Absent means the panel reports tokens only. */
  readonly inputCostPerMTok?: number | undefined;
  readonly outputCostPerMTok?: number | undefined;
}

/** A million, spelled once. The unit every provider publishes its rate in. */
const PER = 1_000_000;

export interface CostView {
  readonly days: readonly DayUsage[];
  readonly byKind: readonly KindUsage[];
  readonly totals: CostTotals;
  /**
   * What it all cost, or **null when no rate is configured**.
   *
   * Null and not zero: nobody has told the panel what a token costs is not
   * *the model was free*.
   */
  readonly spend: number | null;
  /** Spend over games actually generated — C4.6's denominator. */
  readonly perGame: number | null;
  /** Spend over the people who played. */
  readonly perPlayer: number | null;
  /** Tokens per generated game, which needs no rate and is always shown. */
  readonly tokensPerGame: number | null;
}

/**
 * A rate read out of the environment, or undefined.
 *
 * **`Number('')` is 0**, and `Number(undefined)` is `NaN`. Both would arrive
 * here as *a rate*, and the first is the one wrong answer available: it prices
 * the model at nothing and reports a spend of zero, which looks like an
 * unusually cheap month rather than a variable nobody set.
 *
 * Here rather than in the route, because it is a rule about reading a rate and
 * the route is wiring — and because a rule in a page file is a rule with no
 * test. A mutation removing the empty-string guard passed everything until it
 * moved.
 */
export function rateFrom(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/** Tokens priced, or null when either half of the rate is missing. */
export function spendOf(
  totals: Pick<CostTotals, 'inputTokens' | 'outputTokens'>,
  input: number | undefined,
  output: number | undefined,
): number | null {
  // **Both or neither.** One rate configured and the other forgotten would
  // report a cost missing its larger half — output tokens are the dearer side
  // on every provider — and a number that is wrong by a factor is worse than
  // an absent one, because it looks like an answer.
  if (input === undefined || output === undefined) return null;
  return (totals.inputTokens * input + totals.outputTokens * output) / PER;
}

/** A quotient, or null when there is nothing to divide by. `shareOf`'s rule. */
function per(total: number | null, count: number): number | null {
  if (total === null || count <= 0) return null;
  return total / count;
}

export async function readCost(context: CostContext, range: Range): Promise<CostView> {
  const window = windowOf(range);
  const [days, byKind, totals] = await Promise.all([
    // The day series always has a lower bound, even on an all-time range: a
    // chart with one bar per day since the beginning is not a chart.
    usageByDay(context.db, range.fromMs),
    usageByKind(context.db, window),
    selectCostTotals(context.db, window),
  ]);

  const spend = spendOf(totals, context.inputCostPerMTok, context.outputCostPerMTok);

  return {
    days,
    byKind,
    totals,
    spend,
    perGame: per(spend, totals.gamesGenerated),
    perPlayer: per(spend, totals.players),
    tokensPerGame: per(totals.inputTokens + totals.outputTokens, totals.gamesGenerated),
  };
}
