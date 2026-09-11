'use client';

// Step C.2 — the stage: a camera that never moves, and beats that travel past it.
//
// The camera is `position: sticky`, which means the browser holds it still while
// the track scrolls underneath. Nothing here listens for a wheel event, and the
// scrollbar stays the real one, the right length, moved by the keyboard and the
// trackpad exactly as the browser intends. That is non-negotiable 1, and it is
// bought by using a feature rather than by resisting one.
//
// **Two conditions have to hold before any of it engages**, and both live in the
// stylesheet so they hold before hydration and without JavaScript:
//
// - `prefers-reduced-motion: no-preference` — a viewer who asked for less gets
//   the document of step C.1, in order, complete. Not a frozen scene.
// - `md` and up — a fixed camera on a 640px-tall phone is a viewport that clips
//   the article it is trying to show. A phone reads the document too.
//
// And a third that the stylesheet cannot answer: **JavaScript**. The camera with
// no driver would hold the first beat still and never advance it, so the
// `<noscript>` block below hands the document back. It is the one place in this
// repository that earns an `!important`: it has to beat utility classes it does
// not own, and it is inert in every browser that runs the script.
import { Children, useRef, type CSSProperties, type ReactNode } from 'react';

import { beatProgressFor } from './stage-progress.js';
import { BEAT_ATTRIBUTE, CAMERA_ATTRIBUTE, useStage } from './use-stage.js';

/**
 * The stylesheet reverting itself, for a browser with no script to drive it.
 *
 * Step C.6 rewrote this, and what it got wrong is the more useful half. The
 * first version reverted the three declarations that make the stage a stage —
 * the track's height, the camera's stickiness, the beat's position — and left
 * every ramp *inside* it running. So a browser with scripting off received beat
 * 1 and three blank screens: the copy of beats 2 to 4, both captions, all four
 * scoreboard rows and the second call to action were at `opacity: 0`, because
 * their `--beat-progress` says they have not had their turn and nothing was ever
 * going to give them one.
 *
 * `stage.test.tsx` passed throughout. It asserted that the block *contained*
 * `opacity: 1 !important`, which it did, of the one element that was not the
 * problem. That is why C.6 is a browser journey and not a fourth string match.
 *
 * The repair is the first line below rather than a list of the ramps: **the
 * scene at rest is the document.** Every ramp in every one of the scene's
 * stylesheets is a `clamp()` around `--beat-progress`, and every one of them
 * resolves to its finished value at zero — the copy solid, the rows arrived, the
 * mark wiped, the depth vocabulary at no offset. Pinning that one variable
 * neutralises rules this file has never heard of, including the ones a later
 * beat adds. An enumeration would have had to be extended by whoever wrote them,
 * and would not have been.
 *
 * The rest is layout, and it is the part that has to be enumerated: a flow the
 * scene took elements out of, and a grid it laid two of them on.
 * `movement.test.ts` holds this block to the scene's own rules, so a new
 * `position: absolute` or `display: grid` behind the media query fails here
 * rather than in a browser nobody runs without JavaScript.
 *
 * It is the one place in this repository that earns an `!important`: it has to
 * beat utility classes it does not own — and an inline `--beat-progress`, which
 * a normal declaration would lose to — and it is inert in every browser that
 * runs the script.
 */
export const WITHOUT_SCRIPT = `
.landing-stage__beat { --beat-progress: 0 !important; }
.landing-stage__track { height: auto !important; }
.landing-stage__camera { position: static !important; height: auto !important; overflow: visible !important; }
.landing-stage__beat { position: static !important; display: block !important; overflow: visible !important; opacity: 1 !important; transform: none !important; }
.landing-article { display: block !important; }
`;

export interface StageProps {
  /** One child per beat, in the order the scroll tells them. */
  readonly children: ReactNode;
}

export function Stage({ children }: StageProps) {
  const beats = Children.toArray(children);
  const track = useRef<HTMLDivElement>(null);

  useStage(track);

  return (
    <div
      ref={track}
      className="landing-stage__track"
      // The count belongs to the markup, not to the stylesheet: adding a beat is
      // adding a child, and the track grows by one screen without a rule moving.
      style={{ '--stage-beats': beats.length, '--stage-progress': 0 } as CSSProperties}
    >
      <noscript>
        {/* A module constant, with nothing of anybody's in it. */}
        <style dangerouslySetInnerHTML={{ __html: WITHOUT_SCRIPT }} />
      </noscript>

      <div className="landing-stage__camera" {...{ [CAMERA_ATTRIBUTE]: '' }}>
        {beats.map((beat, index) => (
          <div
            // The index *is* the identity: a beat has no meaning beyond its
            // place in the scene, and reordering them reorders the story.
            key={index}
            className="landing-stage__beat"
            // The scene at rest, rendered rather than waited for. Without it
            // every beat falls back to `--beat-progress: 0` until the driver's
            // first frame — four beats stacked at full opacity, which is a
            // visible flash on every load and the first thing a visitor sees.
            //
            // `inert` is deliberately *not* rendered with it: a browser running
            // no script never reaches the driver, and beats it could not focus
            // would be a page with three quarters of itself missing.
            style={
              {
                '--beat-progress': beatProgressFor(0, index, beats.length),
              } as CSSProperties
            }
            {...{ [BEAT_ATTRIBUTE]: '' }}
          >
            {beat}
          </div>
        ))}
      </div>
    </div>
  );
}
