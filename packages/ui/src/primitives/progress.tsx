'use client';

// A client component, every one of them.
//
// Radix reads the DOM — focus, keyboard, portals — and Next needs to be told
// before it tries to render one on the server. Marked on all of them rather
// than only the ones that need it today: a primitive that grows a handler and
// forgets the directive fails at build time in the application, a long way from
// here.

// The hairline progress bar. `components/ui/HairProgress.jsx`, transcribed.
//
// The current one is two nested `<div>`s: a sighted player sees a bar filling
// and nobody else learns anything. Radix's `Progress` carries `role="progressbar"`
// and the aria values, so "forty seconds left" is available rather than implied.
//
// The eased width transition is the one from the legacy component, to the
// millisecond and to the curve — it is what makes the bar read as time passing
// rather than as a value jumping.
import { Indicator, Root } from '@radix-ui/react-progress';
import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '../cn.js';

export type ProgressProps = ComponentPropsWithoutRef<typeof Root> & {
  /** Out of `max`, clamped. A value outside the range is a bug upstream. */
  readonly value?: number | null;
};

export function Progress({ className, value, max, ...props }: ProgressProps) {
  const ceiling = max ?? 100;
  const filled = Math.max(0, Math.min(ceiling, value ?? 0));

  return (
    <Root
      value={filled}
      max={ceiling}
      className={cn(
        'h-2 w-full overflow-hidden rounded-none border-3 border-line-strong bg-surface',
        className,
      )}
      {...props}
    >
      <Indicator
        className="h-full rounded-none bg-accent transition-[width] duration-600 ease-[cubic-bezier(.2,.6,.2,1)] motion-reduce:transition-none"
        style={{ width: `${String((filled / ceiling) * 100)}%` }}
      />
    </Root>
  );
}
