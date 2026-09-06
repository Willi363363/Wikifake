// Step C.2 — the scene's arithmetic, without a browser.
//
// Every number the stage spends is computed here, so this is where the scroll
// scene is actually checked. A test that drove a real viewport would prove that
// scrolling moves things; these prove *by how much*, which is the part a
// refactor breaks silently.
import { describe, expect, it } from 'vitest';

import {
  BEAT_FADE_EDGE,
  beatProgressFor,
  onStageFor,
  progressFor,
} from './stage-progress.js';

/** Four beats, a 800px viewport, a track starting 100px down the document. */
const GEOMETRY = { trackTop: 100, trackHeight: 3200, viewportHeight: 800 };

describe('C.2 — progress across the stage', () => {
  it('is 0 as the camera arrives and 1 as it leaves', () => {
    expect(progressFor(100, GEOMETRY)).toBe(0);
    // The travel is the track minus the camera: the last 800px of track are the
    // camera standing on the finish line, not more scene.
    expect(progressFor(100 + 2400, GEOMETRY)).toBe(1);
  });

  it('is linear in between', () => {
    expect(progressFor(100 + 600, GEOMETRY)).toBeCloseTo(0.25);
    expect(progressFor(100 + 1200, GEOMETRY)).toBeCloseTo(0.5);
  });

  it('clamps above and below the track', () => {
    // Above it the scene has not started; below it, it is over. A value running
    // to −4 would have every beat computing a position no viewer can reach.
    expect(progressFor(0, GEOMETRY)).toBe(0);
    expect(progressFor(999_999, GEOMETRY)).toBe(1);
  });

  it('answers 0 rather than dividing by zero when there is no travel', () => {
    // A viewport taller than the track — a desktop window at 1200px against a
    // three-beat stage that has not laid out yet.
    expect(progressFor(500, { trackTop: 0, trackHeight: 800, viewportHeight: 800 })).toBe(
      0,
    );
    expect(progressFor(500, { trackTop: 0, trackHeight: 400, viewportHeight: 800 })).toBe(
      0,
    );
  });
});

describe('C.2 — progress seen from one beat', () => {
  it('is 0 while a beat holds the stage', () => {
    // Four beats, three handovers: beat 0 holds it at the top of the track and
    // beat 3 holds it at the bottom, so the first screen a visitor sees and the
    // last one they reach are both a beat at rest.
    expect(beatProgressFor(0, 0, 4)).toBe(0);
    expect(beatProgressFor(1, 3, 4)).toBe(0);
    expect(beatProgressFor(1 / 3, 1, 4)).toBeCloseTo(0);
    expect(beatProgressFor(2 / 3, 2, 4)).toBeCloseTo(0);
  });

  it('is ±1 at the neighbours’ turns', () => {
    expect(beatProgressFor(1 / 3, 0, 4)).toBeCloseTo(1);
    expect(beatProgressFor(0, 1, 4)).toBeCloseTo(-1);
  });

  it('crosses its neighbour halfway between them', () => {
    // The handover: one beat half a step past its turn, the next half a step
    // short of its own, and the stylesheet's ramps are symmetric about that.
    const half = 1 / 6;
    expect(beatProgressFor(half, 0, 4)).toBeCloseTo(0.5);
    expect(beatProgressFor(half, 1, 4)).toBeCloseTo(-0.5);
  });

  it('does not clamp, deliberately', () => {
    // Clamping here would park every beat that has not arrived in exactly the
    // same place, which is a scene with one beat in it.
    expect(beatProgressFor(0, 3, 4)).toBe(-3);
    expect(beatProgressFor(1, 0, 4)).toBe(3);
  });

  it('holds the stage for the whole track when there is only one beat', () => {
    expect(beatProgressFor(0, 0, 1)).toBe(0);
    expect(beatProgressFor(1, 0, 1)).toBe(0);
  });
});

describe('C.2 — the window a beat is on stage for', () => {
  it('reaches the same distance either side of its turn', () => {
    expect(onStageFor(0)).toBe(true);
    expect(onStageFor(BEAT_FADE_EDGE - 0.01)).toBe(true);
    expect(onStageFor(-(BEAT_FADE_EDGE - 0.01))).toBe(true);
    expect(onStageFor(BEAT_FADE_EDGE)).toBe(false);
    expect(onStageFor(-BEAT_FADE_EDGE)).toBe(false);
  });

  it('closes on beats that are nowhere near', () => {
    // This is what keeps the keyboard out of three invisible calls to action:
    // the driver marks everything outside this window `inert`.
    expect(onStageFor(-3)).toBe(false);
    expect(onStageFor(3)).toBe(false);
  });

  it('is narrow enough that a handover is never two readable beats', () => {
    // Both beats of a handover sit at ±0.5, inside the window — that overlap is
    // the point. What must not happen is a *third* beat joining them.
    expect(onStageFor(0.5)).toBe(true);
    expect(onStageFor(-0.5)).toBe(true);
    expect(onStageFor(1.5)).toBe(false);
  });
});
