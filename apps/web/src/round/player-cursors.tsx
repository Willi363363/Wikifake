'use client';

// Another player's pointer, drawn where they left it.
//
// Two changes from the current component, and only one of them is the leak.
//
// The position is a percentage, so nothing reads `window` — see `cursors.ts`.
//
// And the glide is 120 ms rather than 1,600. That number was tuned when this
// component animated fake bots strolling across the page; against a real stream
// arriving every 60 ms it means the cursor is always interpolating towards a
// position that is already twenty-six updates old, so it shows where the player
// was more than a second ago and never arrives anywhere. Twice the send interval
// smooths the steps without inventing a delay.
import { cn } from '@wikifake/ui';

import { THROTTLE_MS } from './cursors.js';

/** One pointer, ready to draw. */
export interface CursorView {
  readonly name: string;
  readonly colour: string;
  readonly x: number;
  readonly y: number;
}

export interface PlayerCursorsProps {
  readonly cursors: readonly CursorView[];
}

export function PlayerCursors({ cursors }: PlayerCursorsProps) {
  if (cursors.length === 0) return null;

  return (
    <div
      // Decoration, and nothing else: where somebody else's mouse is is not
      // information a screen reader has any use for, and announcing it sixteen
      // times a second would make the round unusable.
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-20 overflow-hidden"
    >
      {cursors.map((cursor) => (
        <span
          key={cursor.name}
          data-cursor={cursor.name}
          className={cn(
            'absolute flex items-start',
            'transition-[left,top] ease-out',
            // A pointer sliding across the page is motion. Under the preference
            // it snaps, which is still legible and is not a moving object.
            'motion-reduce:transition-none',
          )}
          style={{
            left: `${String(cursor.x * 100)}%`,
            top: `${String(cursor.y * 100)}%`,
            transitionDuration: `${String(THROTTLE_MS * 2)}ms`,
          }}
        >
          <svg viewBox="0 0 16 16" className="size-4 shrink-0 drop-shadow-sm">
            <path
              d="M2 2 L2 12 L5 9 L7 14 L9 13 L7 8.5 L11 8.5 Z"
              fill={cursor.colour}
              stroke="white"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="-ml-1 translate-y-3 rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold tracking-[0.08em] whitespace-nowrap text-white shadow-sm"
            style={{ background: cursor.colour }}
          >
            {cursor.name}
          </span>
        </span>
      ))}
    </div>
  );
}
