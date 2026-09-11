'use client';

// Step C.2 — the driver: the scroll offset, published as a custom property.
//
// It listens, it never intercepts. The listener is passive, so it *cannot* call
// `preventDefault` even by accident — non-negotiable 1 enforced by the browser
// rather than by a reviewer.
//
// The performance budget of non-negotiable 3, decided here rather than
// discovered later:
//
// - **One read per frame, and it is `scrollY`.** Geometry — the track's top and
//   height, the camera's height — is measured on mount and again only when
//   something resizes. Reading `getBoundingClientRect()` inside the frame would
//   force layout on every one of them, which is the usual way a scroll scene
//   ends up at 30fps on a phone.
// - **Writes are custom properties, and the stylesheet spends them on
//   `transform` and `opacity` alone.** Composite-only: a frame costs no layout
//   and no paint.
// - **rAF-batched.** A scroll event fires far more often than the compositor
//   draws; without this the same numbers are computed several times per frame.
// - **Detached off-screen.** An `IntersectionObserver` stops the painting once
//   the stage has left the viewport, so a visitor reading the footer is not
//   paying for a scene nobody can see.
//
// Whether the stage is engaged at all is asked of the **stylesheet**, never
// re-decided here: the camera is `sticky` at `md` and up under
// `prefers-reduced-motion: no-preference`, and `getComputedStyle` reports what
// actually applied. A breakpoint written once in CSS and again in JavaScript is
// a pair that disagrees the first time either moves.
import { useEffect, type RefObject } from 'react';

import { beatProgressFor, onStageFor, progressFor } from './stage-progress.js';
import type { StageGeometry } from './stage-progress.js';

/** The custom properties the stylesheet reads. */
export const STAGE_PROGRESS = '--stage-progress';
export const BEAT_PROGRESS = '--beat-progress';

/** How the driver finds the parts of a stage it was handed the track of. */
export const CAMERA_ATTRIBUTE = 'data-stage-camera';
export const BEAT_ATTRIBUTE = 'data-stage-beat';

interface Parts {
  readonly camera: HTMLElement;
  readonly beats: readonly HTMLElement[];
}

function partsOf(track: HTMLElement): Parts | null {
  const camera = track.querySelector<HTMLElement>(`[${CAMERA_ATTRIBUTE}]`);
  if (camera === null) return null;
  return {
    camera,
    beats: [...track.querySelectorAll<HTMLElement>(`[${BEAT_ATTRIBUTE}]`)],
  };
}

/** Whether the stylesheet has actually engaged the camera at this width. */
function engaged(camera: HTMLElement): boolean {
  return globalThis.getComputedStyle(camera).position === 'sticky';
}

function measure(track: HTMLElement, parts: Parts): StageGeometry {
  const box = track.getBoundingClientRect();
  return {
    trackTop: box.top + globalThis.scrollY,
    trackHeight: box.height,
    viewportHeight: parts.camera.getBoundingClientRect().height,
  };
}

function paint(track: HTMLElement, parts: Parts, geometry: StageGeometry): void {
  const progress = progressFor(globalThis.scrollY, geometry);
  track.style.setProperty(STAGE_PROGRESS, progress.toFixed(4));

  parts.beats.forEach((beat, index) => {
    const local = beatProgressFor(progress, index, parts.beats.length);
    beat.style.setProperty(BEAT_PROGRESS, local.toFixed(4));
    // A transparent link is still a link: it takes clicks and it takes focus.
    beat.inert = !onStageFor(local);
  });
}

/**
 * Publishes the scroll position onto the stage, for as long as it is on screen.
 *
 * Does nothing at all when the stylesheet has not engaged the camera — a phone,
 * or a viewer who asked for less motion. There is no second copy of that
 * decision here to fall out of step with the first.
 */
export function useStage(track: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = track.current;
    if (element === null) return;

    const parts = partsOf(element);
    if (parts === null || !engaged(parts.camera)) return;

    let geometry = measure(element, parts);
    let onScreen = true;
    let queued = false;

    const draw = (): void => {
      queued = false;
      if (onScreen) paint(element, parts, geometry);
    };

    const schedule = (): void => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(draw);
    };

    const watcher = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? false;
      if (onScreen) schedule();
    });
    watcher.observe(element);

    // The track's height is in viewport units, so it changes with the window and
    // with a phone's address bar retracting — the first fires `resize`, the
    // second does not, and `ResizeObserver` reports both.
    const sizes = new ResizeObserver(() => {
      geometry = measure(element, parts);
      schedule();
    });
    sizes.observe(element);

    globalThis.addEventListener('scroll', schedule, { passive: true });
    schedule();

    return () => {
      globalThis.removeEventListener('scroll', schedule);
      watcher.disconnect();
      sizes.disconnect();
    };
  }, [track]);
}
