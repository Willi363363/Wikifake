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
          <svg viewBox="0 0 16 16" className="size-4 shrink-0">
            <path
              d="M2 2 L2 12 L5 9 L7 14 L9 13 L7 8.5 L11 8.5 Z"
              fill={cursor.colour}
              // The structural border, drawn as the arrow's outline. It was
              // `stroke="white"`, which is a colour nobody declared and which
              // disappears against the paper it is usually over; `line-strong`
              // inverts with the palette the way every other border does.
              stroke="var(--color-line-strong)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          <span
            // The name is `ink` on `surface`, with the player's colour beside
            // it as a swatch rather than under it as a fill.
            //
            // It was `text-white` on `style={{ background: cursor.colour }}`,
            // which is the direction's one hard colour rule broken in the one
            // spelling no scanner in this repository can see — the fill is a
            // value from `PLAYER_COLOURS`, chosen by the server. Half of those
            // eight are light (`#f4a261` puts white at about 2:1) and half are
            // dark (`#264653` puts black at about 2.3:1), so **no** single text
            // colour passes on that fill. Moving the colour to a swatch is what
            // makes the pair measurable at all, and it keeps the identity: the
            // arrow above is still filled with it.
            className="-ml-1 flex translate-y-3 items-center gap-1 border-3 border-line-strong bg-surface px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-[0.08em] whitespace-nowrap text-ink"
          >
            <span
              aria-hidden="true"
              className="size-1.5"
              style={{ background: cursor.colour }}
            />
            {cursor.name}
          </span>
        </span>
      ))}
    </div>
  );
}
