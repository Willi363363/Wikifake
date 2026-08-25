'use client';

// A client component, every one of them.
//
// Radix reads the DOM — focus, keyboard, portals — and Next needs to be told
// before it tries to render one on the server. Marked on all of them rather
// than only the ones that need it today: a primitive that grows a handler and
// forgets the directive fails at build time in the application, a long way from
// here.

// The label, which the current game has none of.
//
// Every input in the current interface is a bare `<input>` with a placeholder
// standing in for a name — which disappears the moment anything is typed, and is
// not announced as a label to begin with. Radix's `Label` associates itself with
// the control it wraps or points at, so clicking it focuses the field and a
// screen reader has something to say.
import { Root } from '@radix-ui/react-label';
import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '../cn.js';

export type LabelProps = ComponentPropsWithoutRef<typeof Root>;

export function Label({ className, ...props }: LabelProps) {
  return (
    <Root
      className={cn(
        'text-xs font-medium tracking-wide text-muted uppercase',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-40',
        className,
      )}
      {...props}
    />
  );
}
