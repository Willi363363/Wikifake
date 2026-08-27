// The paragraph token's visual states, and which one wins.
//
// The current component decides this with a cascade of `if/else` inside its own
// render — verdict beats selection, selection beats a hint, a hint beats a scan
// — so the ordering exists once, in a place nothing can test and every future
// screen would have to copy. Here it is a function and a table.
//
// This is **presentation**, not a rule of the game. Whether a marked paragraph
// counts as found is `gradeAnswer` in `@wikifake/domain` and is decided by the
// server; what arrives here is the verdict, and all this does is decide which of
// eight looks the paragraph wears.

/** The seven states of `article.css`, and the eighth: no state at all. */
export type TokenState =
  /** Untouched, and the round is running. */
  | 'idle'
  /** Marked as suspect. */
  | 'selected'
  /** Marked, with a correction typed — expert mode. */
  | 'edited'
  /** C1.6 — the SCANNER pointed at it. */
  | 'scanned'
  /** C1.4 — a hint was bought on it. */
  | 'hinted'
  /** After the round: falsified, and marked. */
  | 'found'
  /** After the round: falsified, and let through. */
  | 'missed'
  /** After the round: marked, and not falsified. */
  | 'false-positive';

export const TOKEN_STATES: readonly TokenState[] = [
  'idle',
  'selected',
  'edited',
  'scanned',
  'hinted',
  'found',
  'missed',
  'false-positive',
];

/**
 * C1.2 — the three that only exist once the round is over.
 *
 * They need the solution, and the solution leaves the server exactly once, with
 * `game_end`. The component must therefore work with none of this: a paragraph
 * with no verdict is `idle`, which is what every screen renders before the end.
 */
export const VERDICT_STATES: readonly TokenState[] = [
  'found',
  'missed',
  'false-positive',
];

/** Whether the paragraph can still be marked. The verdicts cannot. */
export function isInteractive(state: TokenState): boolean {
  return !VERDICT_STATES.includes(state);
}

/**
 * What a screen knows about one paragraph.
 *
 * Every field optional and every default false: before the round ends a screen
 * has none of the verdict, which is the point of C1.2.
 */
export interface TokenFacts {
  /** The player marked it. */
  readonly marked?: boolean;
  /** The player typed a correction — expert mode. */
  readonly corrected?: boolean;
  /** C1.4 — a hint was bought on this falsification. */
  readonly hinted?: boolean;
  /** C1.6 — the SCANNER pointed here. */
  readonly scanned?: boolean;
  /** The verdict, once there is one. Absent while the round runs. */
  readonly verdict?: 'found' | 'missed' | 'false-positive' | null;
}

/**
 * Which of the eight looks this paragraph wears.
 *
 * The order is the current component's, kept: a verdict replaces everything —
 * once the round is over, "you marked this" is no longer the interesting fact —
 * then a correction, then a mark, then what the player paid to learn.
 */
export function tokenStateFor(facts: TokenFacts): TokenState {
  if (facts.verdict != null) return facts.verdict;
  if (facts.corrected === true) return 'edited';
  if (facts.marked === true) return 'selected';
  if (facts.hinted === true) return 'hinted';
  if (facts.scanned === true) return 'scanned';
  return 'idle';
}

/**
 * What the state is called, for anybody who cannot see the colour.
 *
 * English, like everything else in this repository for now; phase 11 replaces
 * them through the component's `label` prop rather than by editing this. They
 * are **not** decoration: the current component says "found" with a green
 * background and a `::after` tick, and a pseudo-element's `content` is
 * inconsistently exposed to assistive technology and cannot be translated at
 * all — which is how `"🔎 INDICE"` ended up as French text inside a stylesheet.
 */
export const TOKEN_LABELS: Readonly<Record<TokenState, string | null>> = {
  idle: null,
  selected: 'marked as suspect',
  edited: 'corrected',
  scanned: 'hint',
  hinted: 'hint bought',
  found: 'found',
  missed: 'missed',
  'false-positive': 'wrongly marked',
};
