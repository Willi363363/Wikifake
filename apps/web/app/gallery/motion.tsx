'use client';

// The animations, shown without playing them at anybody.
//
// A gallery of these that looped them all would be the hazard it exists to
// document: three of the sixteen strobe at about 4.4 flashes a second and two
// more displace the page ten times a second. So the fades play — they are not
// motion — and everything that flashes or displaces sits still behind a button
// somebody has to press.
//
// Which is also the honest demonstration: the preference is what turns those
// same seven off, and a viewer with it set will find the buttons do nothing.
import { MOTIONS, cn, Badge, Button } from '@wikifake/ui';
import type { Motion } from '@wikifake/ui';
import { useState } from 'react';

const TONE = {
  fade: 'green',
  settle: 'accent',
  flash: 'danger',
  displace: 'warn',
} as const;

function Card({ motion }: { motion: Motion }) {
  // The safe ones run from the start; the rest wait to be asked.
  const [playing, setPlaying] = useState(!motion.reducible);

  return (
    <li className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <code className="block text-sm text-ink">animate-{motion.name}</code>
          <span className="mt-0.5 block text-xs text-muted">{motion.role}</span>
        </div>
        <Badge tone={TONE[motion.kind]} className="shrink-0">
          {motion.kind}
        </Badge>
      </div>

      <div className="mt-4 flex items-center gap-3">
        {/* The stage. `overflow-hidden` because two of these travel the width of
            the viewport and one of them travels its height. */}
        <div className="relative h-12 min-w-0 flex-1 overflow-hidden rounded-md bg-bg-grain">
          <span
            key={playing ? 'on' : 'off'}
            className={cn(
              'absolute top-1/2 left-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-accent',
              playing && `animate-${motion.name}`,
            )}
          />
        </div>

        {motion.reducible ? (
          <Button
            size="default"
            className="shrink-0"
            variant={playing ? 'danger' : 'ghost'}
            onClick={() => {
              setPlaying((was) => !was);
            }}
          >
            {playing ? 'Stop' : 'Play'}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function MotionGallery() {
  return (
    <div className="rounded-xl border border-line bg-bg p-6 text-ink">
      <p className="mb-4 max-w-prose text-sm text-muted">
        Sixteen keyframes, carried over from the current game. The seven marked{' '}
        <em>flash</em> or <em>displace</em> do not play on their own: they are a
        photosensitivity and vestibular hazard, and <code>prefers-reduced-motion</code>{' '}
        switches every one of them off. With the preference set, the buttons below do
        nothing — which is the point.
      </p>
      <ul className="grid gap-3 md:grid-cols-2">
        {MOTIONS.map((motion) => (
          <Card key={motion.name} motion={motion} />
        ))}
      </ul>
    </div>
  );
}
