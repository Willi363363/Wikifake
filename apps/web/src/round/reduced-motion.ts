'use client';

// Whether this viewer has asked for less motion.
//
// The stylesheet already answers this for everything that is a CSS animation:
// phase 6 made each keyframe a variable so a media query can set it to `none`,
// and `motion.test.ts` holds the reducible list and the stylesheet together. So
// nothing here needs to switch off a `shake`.
//
// What CSS cannot switch off is a canvas being redrawn twenty-five times a
// second, which is what the TV static of `HINT_LOCK` does — for twenty seconds,
// full screen. That is a photosensitivity hazard a stylesheet has no reach over,
// so the preference has to be readable from JavaScript too.
//
// `useSyncExternalStore` rather than `useState` in an effect, and the difference
// is a frame. Read in an effect, the first render says "full motion", the loop
// starts, and it is cancelled on the second render — so a viewer who asked for
// less motion gets one frame of exactly what they asked not to see. Here the
// client's first render already has the answer, and the separate server snapshot
// is what keeps that from being a hydration mismatch.
import { useSyncExternalStore } from 'react';

export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function query(): MediaQueryList | null {
  return globalThis.matchMedia?.(REDUCED_MOTION) ?? null;
}

function subscribe(onChange: () => void): () => void {
  const media = query();
  if (media === null) return () => undefined;

  // A preference changed mid-round applies mid-round.
  media.addEventListener('change', onChange);
  return () => {
    media.removeEventListener('change', onChange);
  };
}

const clientSnapshot = (): boolean => query()?.matches ?? false;

/** No media queries on a server, so: full motion, and corrected on arrival. */
const serverSnapshot = (): boolean => false;

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
