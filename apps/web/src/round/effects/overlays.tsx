'use client';

// Which sheets are on screen, and in what order.
//
// The switchboard is exhaustive over `Overlay`, so an effect added to the table
// without a component fails to compile — the current game wires eight of them by
// hand in `GameSession`, which is where one would quietly go missing.
import { Blizzard, Confetti } from './falling.js';
import { Rickroll } from './rickroll.js';
import { Blackout, Fog, Lightning, Quake } from './screen.js';
import { Static } from './static.js';
import type { Overlay } from '../effects.js';

export interface OverlaysProps {
  readonly active: ReadonlySet<Overlay>;
  onDismiss(overlay: Overlay): void;
}

/** Painted in this order, so the pop-up is never buried under the static. */
const ORDER: readonly Overlay[] = [
  'fog',
  'earthquake',
  'blackout',
  'blizzard',
  'lightning',
  'static',
  'confetti',
  'rickroll',
];

function sheetFor(overlay: Overlay, onDismiss: (overlay: Overlay) => void) {
  switch (overlay) {
    case 'fog':
      return <Fog />;
    case 'earthquake':
      return <Quake />;
    case 'blackout':
      return <Blackout />;
    case 'blizzard':
      return <Blizzard />;
    case 'lightning':
      return <Lightning />;
    case 'static':
      return <Static />;
    case 'confetti':
      return <Confetti />;
    case 'rickroll':
      return (
        <Rickroll
          onDismiss={() => {
            onDismiss('rickroll');
          }}
        />
      );
  }
}

export function Overlays({ active, onDismiss }: OverlaysProps) {
  if (active.size === 0) return null;

  return (
    <>
      {ORDER.filter((overlay) => active.has(overlay)).map((overlay) => (
        <div key={overlay}>{sheetFor(overlay, onDismiss)}</div>
      ))}
    </>
  );
}
