'use client';

// HINT_LOCK — TV static, and the most delicate thing in the phase.
//
// It is the only canvas in the project: full-screen noise, drawn pixel by pixel,
// at about twenty-five frames a second, for twenty seconds. Three things about
// it are not style choices.
//
//   1. **`prefers-reduced-motion` has to be read in JavaScript.** The stylesheet
//      switches off `static-glitch`, and it cannot switch off a canvas being
//      redrawn. Twenty-five frames a second of full-screen noise is a
//      photosensitivity hazard, so under that preference one frame is drawn and
//      the loop never starts.
//   2. **Dimensions are read in the effect, never at render.** `window` does not
//      exist while this renders on the server, and a canvas sized during render
//      is sized from whatever the last layout was.
//   3. **The frame is cancelled on unmount.** A `requestAnimationFrame` loop
//      that outlives its component is a loop that runs until the tab is closed,
//      and this one allocates a viewport-sized `ImageData` every frame.
import { useEffect, useRef } from 'react';

import { usePrefersReducedMotion } from '../reduced-motion.js';

/** ~25 fps. The current loop's throttle, kept. */
const FRAME_MS = 40;

/** The current mix: mostly black, a little chroma, the rest grey noise. */
const BLACK = 0.45;
const RED = 0.02;
const BLUE = 0.02;

/** Draws one frame of noise into `data`. Exported because it is worth a test. */
export function noiseInto(data: Uint8ClampedArray, random: () => number): void {
  for (let at = 0; at < data.length; at += 4) {
    const roll = random();
    if (roll < BLACK) {
      data[at] = 0;
      data[at + 1] = 0;
      data[at + 2] = 0;
      data[at + 3] = 230;
    } else if (roll < BLACK + RED) {
      data[at] = 200;
      data[at + 1] = 0;
      data[at + 2] = 0;
      data[at + 3] = 160;
    } else if (roll < BLACK + RED + BLUE) {
      data[at] = 0;
      data[at + 1] = 80;
      data[at + 2] = 220;
      data[at + 3] = 120;
    } else {
      const grey = Math.floor(140 + random() * 115);
      data[at] = grey;
      data[at + 1] = grey;
      data[at + 2] = grey;
      data[at + 3] = Math.floor(160 + random() * 95);
    }
  }
}

export function Static() {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const still = usePrefersReducedMotion();

  useEffect(() => {
    const surface = canvas.current;
    const context = surface?.getContext('2d') ?? null;
    if (surface === null || context === null) return undefined;

    // Read here, not at render: `window` is not there on the server, and a size
    // taken during render is a size from the previous layout.
    const width = (surface.width = globalThis.innerWidth);
    const height = (surface.height = globalThis.innerHeight);

    const paint = (): void => {
      const frame = context.createImageData(width, height);
      noiseInto(frame.data, Math.random);
      context.putImageData(frame, 0, 0);
    };

    paint();
    // One frame, and no loop. Twenty-five frames a second of full-screen noise
    // is the hazard, not the noise.
    if (still) return undefined;

    let handle = 0;
    let last = 0;
    const loop = (now: number): void => {
      handle = requestAnimationFrame(loop);
      if (now - last < FRAME_MS) return;
      last = now;
      paint();
    };
    handle = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(handle);
    };
  }, [still]);

  return (
    <div
      role="status"
      aria-label="Someone has jammed your intel"
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      <canvas ref={canvas} aria-hidden="true" className="absolute inset-0 size-full" />
      <div className="absolute inset-0 bg-ink/50" />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,color-mix(in_srgb,var(--color-ink)_45%,transparent)_0px,color-mix(in_srgb,var(--color-ink)_45%,transparent)_2px,transparent_2px,transparent_4px)]" />
      <p className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <span className="animate-static-glitch font-mono text-2xl font-bold tracking-[0.35em] text-danger uppercase">
          intel jammed
        </span>
        <span className="font-mono text-xs tracking-[0.28em] text-muted uppercase">
          no signal
        </span>
      </p>
    </div>
  );
}
