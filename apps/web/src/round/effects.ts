'use client';

// What an item looks like when it lands on you.
//
// The table is exhaustive over `ItemId` by type, so an item added to the
// contract without a decision here fails to compile — the same reason the
// domain routes every identifier through one `switch`. The durations are the
// current game's, to the millisecond: they are tuned, and there is nothing to
// be gained by retuning them in a port.
//
// Two kinds of visual, and they are not interchangeable. An **overlay** is a
// full-screen sheet above everything; a **distortion** is done to the article
// itself, which is why `BLUR` has both — a fog over the page and a blurred
// card under it.
import { useCallback, useEffect, useState } from 'react';
import type { ItemId } from '@wikifake/protocol';

import { useTimers } from '../timers.js';

/** The full-screen sheets. */
export type Overlay =
  | 'blizzard'
  | 'lightning'
  | 'static'
  | 'fog'
  | 'earthquake'
  | 'blackout'
  | 'confetti'
  | 'rickroll';

/** What is done to the article card. */
export type Distortion =
  'blur' | 'invert' | 'mirror' | 'tiny' | 'spin' | 'shake' | 'redacted';

export interface EffectSpec {
  readonly overlay?: Overlay;
  readonly distortion?: Distortion;
  /** Milliseconds, or null for "until it is dismissed". */
  readonly lasts: number | null;
}

export const EFFECTS: Readonly<Record<ItemId, EffectSpec | null>> = {
  BLUR: { overlay: 'fog', distortion: 'blur', lasts: 5000 },
  FREEZE_TIME: { overlay: 'blizzard', lasts: 3000 },
  HINT_LOCK: { overlay: 'static', lasts: 20_000 },
  SCORE_STEAL: { overlay: 'lightning', lasts: 3000 },
  BLACKOUT: { overlay: 'blackout', distortion: 'redacted', lasts: 5000 },
  EARTHQUAKE: { overlay: 'earthquake', distortion: 'shake', lasts: 5000 },
  RICKROLL: { overlay: 'rickroll', lasts: null },
  MIRROR: { distortion: 'mirror', lasts: 6000 },
  TINY: { distortion: 'tiny', lasts: 8000 },
  SPIN: { distortion: 'spin', lasts: 4000 },
  CONFETTI: { overlay: 'confetti', lasts: 6000 },
  INVERT: { distortion: 'invert', lasts: 5000 },
  // C1.6 — the detector answers with a paragraph. Its whole visual is the token
  // it points at, which step 8.3 already draws.
  SCANNER: null,
};

export interface EffectsState {
  readonly overlays: ReadonlySet<Overlay>;
  readonly distortions: ReadonlySet<Distortion>;
  /** An item landed. */
  cast(itemId: ItemId): void;
  /** Takes an overlay off early — the pop-up has a close button. */
  dismiss(overlay: Overlay): void;
}

/**
 * How many casts of each effect are still running.
 *
 * A count and not a flag, because two of the same item land often — a room of
 * four with a wave each — and a flag means the first cast's expiry switches off
 * the second cast that is still meant to be running. The current game has this
 * bug and it reads as an effect that ends early for no reason.
 */
type Running<T extends string> = Readonly<Partial<Record<T, number>>>;

const NONE = {};

function started<T extends string>(running: Running<T>, key: T): Running<T> {
  return { ...running, [key]: (running[key] ?? 0) + 1 };
}

/**
 * One cast finished.
 *
 * A count of zero is kept rather than removed. The alternative is deleting a
 * computed key, which the linter refuses for a good reason — and "present with
 * zero" and "absent" mean the same thing to the only reader, `activeIn`.
 */
function finished<T extends string>(running: Running<T>, key: T): Running<T> {
  return { ...running, [key]: Math.max(0, (running[key] ?? 0) - 1) };
}

const activeIn = <T extends string>(running: Running<T>): ReadonlySet<T> =>
  new Set(
    // `Object.entries` widens the key to `string` and the value to `{}` on a
    // `Partial<Record<T, …>>`, so both are named back. Honest: the object was
    // only ever written by the two functions above.
    (Object.entries(running) as [T, number | undefined][])
      .filter(([, casts]) => (casts ?? 0) > 0)
      .map(([name]) => name),
  );

/**
 * The effects running right now.
 *
 * Keyed on the round: an effect outliving the round it was cast in is an article
 * shaking under a lobby.
 */
export function useEffects(roundKey: string): EffectsState {
  const timers = useTimers();
  const [overlays, setOverlays] = useState<Running<Overlay>>(NONE);
  const [distortions, setDistortions] = useState<Running<Distortion>>(NONE);

  useEffect(() => {
    timers.clear();
    setOverlays(NONE);
    setDistortions(NONE);
  }, [roundKey, timers]);

  const cast = useCallback(
    (itemId: ItemId) => {
      const spec = EFFECTS[itemId];
      if (spec === null) return;

      const { overlay, distortion, lasts } = spec;
      if (overlay !== undefined) setOverlays((was) => started(was, overlay));
      if (distortion !== undefined) setDistortions((was) => started(was, distortion));
      if (lasts === null) return;

      timers.after(lasts, () => {
        if (overlay !== undefined) setOverlays((was) => finished(was, overlay));
        if (distortion !== undefined) setDistortions((was) => finished(was, distortion));
      });
    },
    [timers],
  );

  // Dismissal ends every cast of it: the pop-up has one close button, and a
  // second one hiding behind the first is a pop-up that will not go away.
  const dismiss = useCallback((overlay: Overlay) => {
    setOverlays((was) => ({ ...was, [overlay]: 0 }));
  }, []);

  return {
    overlays: activeIn(overlays),
    distortions: activeIn(distortions),
    cast,
    dismiss,
  };
}
