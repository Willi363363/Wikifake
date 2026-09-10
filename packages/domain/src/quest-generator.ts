// The quest generator — step F.2.
//
// Given a player, a period and which period it is, it produces the same set
// every time it runs. **That determinism is the whole step**, and it is what
// makes F.5's cron cheap: a run that was missed, or ran twice, or ran late, all
// produce the answer the first run would have produced, so idempotence costs
// nothing and self-healing is the same function called from the read path.
//
// **The seed is derived here rather than passed in**, which is the opposite of
// `selectTopic` and for a reason worth stating. That draw must be
// *unpredictable* — a seed handed in by the caller is what stops the fastest
// voter always winning — and this one must be *reproducible*. Same purity rule,
// opposite requirement: nothing here reads a clock or draws a number, so the
// output is a function of the arguments and of the catalogue alone.
import {
  questRulesFor,
  type QuestPeriod,
  type QuestRule,
  type QuestRuleId,
} from './quests.js';

// `periodIndexOf` used to live here and now lives in `periods.ts`: G.3 became
// its second consumer, and a board's day has to be a quest's day. Re-exported
// so that nothing which learned to import it from this module has to move.
export { periodIndexOf } from './periods.js';

/**
 * How many quests a set holds, per period.
 *
 * Three of the five daily rules and two of the five weekly ones. Three is
 * enough to read as a list rather than as a chore, and the choice of three from
 * five is what makes tomorrow's set different from today's — a set that held
 * every rule would be the same set for ever, and the generator would have
 * nothing to be deterministic *about*.
 *
 * Two weeklies rather than three because they sit beside the dailies: a week's
 * set as long as a day's competes with it for the same attention, and the
 * weekly rewards are four times the size precisely because there are fewer.
 */
export const QUESTS_PER_SET: Readonly<Record<QuestPeriod, number>> = {
  daily: 3,
  weekly: 2,
};

/** A quest as generated: which rule, which period it belongs to, and how much. */
export interface QuestAssignment {
  readonly ruleId: QuestRuleId;
  readonly period: QuestPeriod;
  /** Which day or which week — `periodIndexOf` in `periods.ts`. */
  readonly periodIndex: number;
  /** The number drawn from the rule's range, inclusive at both ends. */
  readonly target: number;
}

/**
 * FNV-1a, 32-bit.
 *
 * A hash and not a draw: it turns the identity of a set — this player, this
 * period, this week — into the number the draws start from. `Math.imul` because
 * the multiply overflows 32 bits and plain `*` would lose the low bits to a
 * double's mantissa, which is how two different players end up with one seed.
 */
function seedFrom(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * mulberry32 — a small deterministic sequence in `[0, 1)`.
 *
 * Chosen for being one statement of arithmetic with no state but a 32-bit
 * counter: it is auditable at a glance, it needs no clock, and it gives the same
 * sequence on every engine. Its statistical quality is irrelevant here — this
 * picks three quests out of five, it does not simulate anything.
 */
function drawsFrom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Fisher-Yates, driven by `draw`.
 *
 * Shuffle-then-take rather than pick-k-at-random, because picking has to handle
 * the collision — the same rule drawn twice — and every way of handling it
 * biases the result or loops. A shuffled list cannot repeat by construction.
 */
function shuffled<T>(items: readonly T[], draw: () => number): T[] {
  const order = [...items];
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(draw() * (index + 1));
    const held = order[index] as T;
    order[index] = order[swap] as T;
    order[swap] = held;
  }
  return order;
}

/** A number in the rule's range, both ends included. */
function targetFor(rule: QuestRule, draw: () => number): number {
  const span = rule.target.max - rule.target.min + 1;
  return rule.target.min + Math.floor(draw() * span);
}

/**
 * The set this player has for this day, or this week.
 *
 * Called with the index rather than an instant on purpose: the index is what
 * F.3 stores and what makes a row unique, so a caller that has one has already
 * decided which period it is asking about. A convenience that took a timestamp
 * and hid the index would be an invitation to write a set nothing can key.
 *
 * The order of the draws is fixed and load-bearing — shuffle first, then one
 * target per chosen rule, in the shuffled order. Drawing the targets before the
 * shuffle, or for every rule rather than the chosen ones, gives a different set
 * from the same seed, which would be a silent break of exactly the guarantee
 * this function exists for.
 */
export function generateQuestSet(
  userId: string,
  period: QuestPeriod,
  periodIndex: number,
): readonly QuestAssignment[] {
  /*
   * The separators are insurance rather than a fix, and saying which matters.
   *
   * Plain concatenation is *already* unambiguous for these three: the period is
   * one of two alphabetic words and it sits between an identifier and a run of
   * digits, so the decomposition is unique — checked by enumeration rather than
   * reasoned about, and a mutation removing the bars breaks no test.
   *
   * They stay because that argument holds only for the key as it is now. The
   * day this gains a fourth component, or the period stops being a word, the
   * bars are what keeps `ab` in 1 from seeding like `a` in `b1` — and a seed
   * collision is invisible: it hands two players the same set for ever and
   * nothing goes red.
   */
  const draw = drawsFrom(seedFrom(`${userId}|${period}|${String(periodIndex)}`));
  const chosen = shuffled(questRulesFor(period), draw).slice(0, QUESTS_PER_SET[period]);

  return chosen.map((rule) => ({
    ruleId: rule.id,
    period,
    periodIndex,
    target: targetFor(rule, draw),
  }));
}
