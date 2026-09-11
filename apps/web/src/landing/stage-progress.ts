// Step C.2 — where the scroll is, expressed as numbers the stylesheet can spend.
//
// Pure, and separate from the hook that calls it, because this is the whole of
// the scene's arithmetic and it deserves to be testable without a browser.
//
// **Nothing here intercepts a scroll.** Non-negotiable 1 of
// `plans/product/03-landing.md`: the page scrolls at the speed the browser says,
// and elements are positioned *from* the offset. Every function below takes the
// offset as an argument and returns a ratio — there is nowhere to put a
// `preventDefault` even if somebody wanted one.

/** What the hook measures once, and re-measures when the layout changes. */
export interface StageGeometry {
  /** The track's top, in document coordinates. */
  readonly trackTop: number;
  /** The track's full height — the beats' worth of scrolling. */
  readonly trackHeight: number;
  /** The camera's height: the part of the track that is not travel. */
  readonly viewportHeight: number;
}

/**
 * How far through the stage the page is: 0 as the camera arrives, 1 as it
 * leaves.
 *
 * Clamped on purpose. Above and below the track the scene is simply at one of
 * its ends, and a value running to −4 would have every beat computing a
 * position no viewer can reach.
 */
export function progressFor(scrollY: number, geometry: StageGeometry): number {
  const travel = geometry.trackHeight - geometry.viewportHeight;
  // A track no taller than the camera has nowhere to travel — a one-beat stage,
  // or a viewport taller than the track. Zero rather than a division by zero.
  if (travel <= 0) return 0;

  const through = (scrollY - geometry.trackTop) / travel;
  return Math.min(1, Math.max(0, through));
}

/**
 * The same progress, seen from one beat: **0 while it holds the stage**,
 * negative before its turn, positive after it.
 *
 * The scale is the number of *transitions*, not the number of beats, and that
 * is the whole reason this is a function rather than a multiplication written
 * in two places. With four beats there are three handovers: beat 0 holds the
 * stage at progress 0 and beat 3 holds it at progress 1, so the first screen a
 * visitor sees and the last one they reach are both a beat at rest rather than
 * a beat halfway through arriving.
 *
 * Deliberately **not** clamped. A beat needs to know how far off-stage it is to
 * know where to wait; clamping would park every beat that has not arrived in
 * exactly the same place, which is a scene with one beat in it.
 */
export function beatProgressFor(progress: number, index: number, beats: number): number {
  // One beat is not a scene: it holds the stage for the whole track.
  if (beats <= 1) return 0;
  return progress * (beats - 1) - index;
}

/**
 * How far either side of its turn a beat is still drawn.
 *
 * Wide on purpose since step C.4. A beat wrapper is solid out to ±0.6 and gone
 * by this, so at a handover — where two beats sit at ±0.5 — **both** are still
 * fully opaque. What cuts instead is the copy inside them, on a much tighter
 * ramp that reaches zero at exactly ±0.5.
 *
 * That is what makes beat 3 a collision rather than a dissolve: the article
 * survives the handover while the words around it cut, so the false paragraph
 * lands on the true one instead of mixing with it. Two blocks of prose at half
 * opacity is a moment nobody can read; this arrangement never produces one.
 *
 * `movement.test.ts` holds this number and the scene's stylesheets together,
 * because a media query cannot import a constant.
 */
export const BEAT_FADE_EDGE = 0.85;

/**
 * The window a beat is on stage for.
 *
 * Outside it the beat is transparent, and a transparent link is still a link —
 * it takes clicks and it takes focus. The driver marks those beats `inert`, and
 * this is the line it draws. A scene with four stacked beats and no such line
 * is a page where the keyboard walks through three invisible calls to action
 * before it reaches the visible one.
 */
export function onStageFor(beatProgress: number): boolean {
  return Math.abs(beatProgress) < BEAT_FADE_EDGE;
}
