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

import { BEAT_ATTRIBUTE, CAMERA_ATTRIBUTE, useStage } from './use-stage.js';

/** The stylesheet reverting itself, for a browser with no script to drive it. */
const WITHOUT_SCRIPT = `
.landing-stage__track { height: auto !important; }
.landing-stage__camera { position: static !important; height: auto !important; overflow: visible !important; }
.landing-stage__beat { position: static !important; opacity: 1 !important; transform: none !important; }
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
      style={{ '--stage-beats': beats.length } as CSSProperties}
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
            {...{ [BEAT_ATTRIBUTE]: '' }}
          >
            {beat}
          </div>
        ))}
      </div>
    </div>
  );
}
