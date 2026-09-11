// What a round is worth in coins — step H.3.
//
// Beside the scoring scale and the quest catalogue, and for the same reason: a
// business rule that must exist in exactly one place. `@wikifake/db` may not
// read it — data does not depend on rules — so the number travels with the
// grade, exactly as `isPerfectRound`'s answer does since E.4.
//
// **Coins are not proportional to score, and that is the decision.** A
// score-proportional reward would pay more for an easy article, and a solo topic
// is one the player chose — which is precisely the gameability that made G.5 keep
// solo rounds off the leaderboards. Paying by the round instead is farmable only
// by *playing*, which is bounded by time and is the behaviour the game wants.

/**
 * What finishing a round pays.
 *
 * Small on purpose. Coins are meant to accumulate from the retention loop —
 * quests, which pay twenty to a hundred and fifty — and a per-round trickle is
 * there so that a player who never opens the quest screen is not earning
 * nothing. If this number ever rivals a quest's, the quests stop mattering.
 */
export const COINS_PER_ROUND = 2;

/**
 * What a perfect round adds — every falsification found, nothing true marked.
 *
 * `isPerfectRound`'s definition, reused rather than restated, which is the same
 * predicate E.4's streak and F.1's `perfect` qualifier are built on. Changing
 * what perfect means stays one function.
 */
export const COINS_PER_PERFECT_ROUND = 3;

/**
 * The coins a finished round earns.
 *
 * Takes what the grading already decided rather than the round itself, so this
 * cannot disagree with the streak or the quest progress about whether a round
 * was perfect.
 */
export function coinsForRound(round: { readonly perfect: boolean }): number {
  return COINS_PER_ROUND + (round.perfect ? COINS_PER_PERFECT_ROUND : 0);
}

/**
 * What a hint costs in coins — step H.4.
 *
 * The score prices are `HINT_COST` (50) and `REVEAL_COST` (200), and these are
 * not a conversion of them: a score point and a coin are not the same kind of
 * thing. What sets these numbers is **what a player earns**. A round pays two
 * and a quest twenty to a hundred and fifty, so a hint at five is two or three
 * rounds and a reveal at fifteen is a day's quest — expensive enough to be a
 * decision, cheap enough to be spent.
 *
 * A reveal costs three times a hint, which is the ratio the score prices use.
 * Not because the ratio must match, but because the *shape* of the choice
 * should: a reveal is the expensive answer either way round.
 */
export const HINT_COINS = 5;
export const REVEAL_COINS = 15;

/**
 * The coin price of a hint at this level.
 *
 * Mirrors `hintCostFor`, which does the same for score, so the two prices are
 * decided by the same shape of function and a level added to one is a level
 * somebody has to price in the other.
 */
export function hintCoinCostFor(level: 1 | 2): number {
  return level >= 2 ? REVEAL_COINS : HINT_COINS;
}
