'use client';

// A client component, every one of them.
//
// Radix reads the DOM — focus, keyboard, portals — and Next needs to be told
// before it tries to render one on the server. Marked on all of them rather
// than only the ones that need it today: a primitive that grows a handler and
// forgets the directive fails at build time in the application, a long way from
// here.

// The hairline. `components/ui/Divider.jsx`, in both orientations.
//
// Decorative unless told otherwise, which is the opposite of what Radix does:
// its `decorative` defaults to false, so every hairline is announced as a
// separator. Most of them are a rule between two paragraphs and mean nothing to
// anybody who cannot see them, and a screen reader reading "separator" eleven
// times down a lobby is noise. A caller that means it as structure passes
// `decorative={false}` and gets Radix's own behaviour back.
import { Root } from '@radix-ui/react-separator';
import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '../cn.js';

export type SeparatorProps = ComponentPropsWithoutRef<typeof Root>;

export function Separator({
  className,
  orientation,
  decorative,
  ...props
}: SeparatorProps) {
  const axis = orientation ?? 'horizontal';
  return (
    <Root
      orientation={axis}
      decorative={decorative ?? true}
      className={cn(
        'shrink-0 bg-line',
        axis === 'horizontal' ? 'h-px w-full' : 'h-4 w-px',
        className,
      )}
      {...props}
    />
  );
}
