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

/**
 * What the bar says it is doing.
 *
 * Cosmetic, and the current code says so: the label is the first stage whose
 * threshold the progress has not passed. Kept because it is the only thing on
 * screen that suggests the wait is bounded.
 */
export const STAGES: readonly { readonly label: string; readonly upTo: number }[] = [
  { label: 'Fetching the article…', upTo: 18 },
  { label: 'Reading it…', upTo: 38 },
  { label: 'Slipping errors in…', upTo: 58 },
  { label: 'Building the page…', upTo: 78 },
  { label: 'Finishing up…', upTo: 92 },
  { label: 'Ready', upTo: 100 },
];

export function stageAt(progress: number): string {
  // The last stage is the fallback, and `noUncheckedIndexedAccess` is right to
  // ask: `STAGES` is a `readonly` array, and nothing here proves to the compiler
  // that it is not empty.
  const stage = STAGES.find((candidate) => progress <= candidate.upTo) ?? STAGES.at(-1);
  return stage?.label ?? 'Ready';
}
