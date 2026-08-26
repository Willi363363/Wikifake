'use client';

// The particles the blizzard and the confetti are made of.
//
// **Generated after mount, never during render.** The current components build
// them in a `useMemo` that calls `Math.random()`, which under a framework that
// renders on the server produces one set of positions in the HTML and a
// different set on hydration — a mismatch by construction, and one React reports
// as a warning for the whole tree rather than for the flake that caused it.
//
// So the hook returns an empty list on the first paint and the pieces on the
// second. Nothing is lost: the first paint of an overlay that has just been
// cast is a sheet with no particles on it for one frame.
import { useEffect, useState } from 'react';

export interface Particle {
  readonly id: number;
  /** Percent across the viewport. */
  readonly left: number;
  /** Seconds, negative so the fall is already under way when it appears. */
  readonly delay: number;
  readonly duration: number;
  readonly size: number;
  readonly opacity: number;
  /** Horizontal travel, in pixels, read by the `snowfall` keyframe. */
  readonly drift: number;
  /** 0, 1 or 2 — the caller decides what each means. */
  readonly variant: number;
}

export interface ParticleSpec {
  readonly count: number;
  readonly minSize: number;
  readonly maxSize: number;
  readonly minDuration: number;
  readonly maxDuration: number;
  readonly spread: number;
}

/** The current game's flakes, and its confetti, to the number. */
export const SNOW: ParticleSpec = {
  count: 120,
  minSize: 8,
  maxSize: 26,
  minDuration: 1.5,
  maxDuration: 4,
  spread: 5,
};

export const CONFETTI: ParticleSpec = {
  count: 80,
  minSize: 8,
  maxSize: 22,
  minDuration: 1.2,
  maxDuration: 3.2,
  spread: 3,
};

/** A field of particles, from a source of randomness the caller owns. */
export function scatter(spec: ParticleSpec, random: () => number): readonly Particle[] {
  return Array.from({ length: spec.count }, (_, id) => ({
    id,
    left: random() * 100,
    delay: -(random() * spec.spread),
    duration: spec.minDuration + random() * (spec.maxDuration - spec.minDuration),
    size: spec.minSize + random() * (spec.maxSize - spec.minSize),
    opacity: 0.75 + random() * 0.25,
    drift: Math.round((random() - 0.5) * 120),
    variant: id % 3,
  }));
}

/**
 * A field of particles, once this is running in a browser.
 *
 * Empty until then, and empty for good under `prefers-reduced-motion`: the fall
 * is `snowfall`, which the stylesheet switches off, and a hundred and twenty
 * motionless flakes stacked at the top of the screen is worse than none.
 */
export function useParticles(spec: ParticleSpec, still: boolean): readonly Particle[] {
  const [pieces, setPieces] = useState<readonly Particle[]>([]);

  useEffect(() => {
    setPieces(still ? [] : scatter(spec, Math.random));
  }, [spec, still]);

  return pieces;
}
