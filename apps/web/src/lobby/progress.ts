// The waiting screen's progress, as arithmetic.
//
// Today it is an interval mutating a `useState`, stopped by an
// `useImperativeHandle` the lobby reaches in through: `ref.ready(data)`. That
// handle is what step 7.5 removes, and the reason it can be removed is here —
// progress is a function of how long we have waited and whether the round has
// arrived, and neither of those needs a component to reach into another one.
//
// The curve is the current one, transcribed: it eases towards 85% over ten
// seconds and stops there, because a bar that reaches 100% before the article
// does is a bar that has lied. Only the round's arrival finishes it.

/** Where the simulated bar stops on its own. */
export const CEILING = 85;

/** How long it takes to approach that ceiling, in milliseconds. */
export const APPROACH_MS = 10_000;

/**
 * How full the bar is.
 *
 * @param elapsedMs since the generation started.
 * @param arrived whether the round is actually here.
 */
export function progressAt(elapsedMs: number, arrived: boolean): number {
  if (arrived) return 100;

  const towards = Math.min(CEILING, (Math.max(0, elapsedMs) / APPROACH_MS) * CEILING);
  // The current easing, to the exponent: fast at first, then visibly slowing,
  // which is what makes a ten-second wait feel like progress rather than a hang.
  return CEILING * (1 - (1 - towards / CEILING) ** 2.5);
}

/** What the bar can say it is doing — catalogue keys under `generation.stages`. */
export type StageKey =
  'fetching' | 'reading' | 'falsifying' | 'building' | 'finishing' | 'ready';

/**
 * What the bar says it is doing.
 *
 * Cosmetic, and the current code says so: the label is the first stage whose
 * threshold the progress has not passed. Kept because it is the only thing on
 * screen that suggests the wait is bounded. A stage is a catalogue key rather
 * than a sentence, because this file is arithmetic and the copy lives in
 * `messages/<locale>/lobby.json` — the screen resolves it (step 11.2).
 */
export const STAGES: readonly { readonly key: StageKey; readonly upTo: number }[] = [
  { key: 'fetching', upTo: 18 },
  { key: 'reading', upTo: 38 },
  { key: 'falsifying', upTo: 58 },
  { key: 'building', upTo: 78 },
  { key: 'finishing', upTo: 92 },
  { key: 'ready', upTo: 100 },
];

export function stageAt(progress: number): StageKey {
  // The last stage is the fallback, and `noUncheckedIndexedAccess` is right to
  // ask: `STAGES` is a `readonly` array, and nothing here proves to the compiler
  // that it is not empty.
  const stage = STAGES.find((candidate) => progress <= candidate.upTo) ?? STAGES.at(-1);
  return stage?.key ?? 'ready';
}
