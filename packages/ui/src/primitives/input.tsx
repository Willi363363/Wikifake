'use client';

// A client component, every one of them.
//
// Radix reads the DOM — focus, keyboard, portals — and Next needs to be told
// before it tries to render one on the server. Marked on all of them rather
// than only the ones that need it today: a primitive that grows a handler and
// forgets the directive fails at build time in the application, a long way from
// here.

// The text field.
//
// The bronze focus glow is gone. It was the previous identity, and it now says
// the wrong thing twice over: `bronze` means *a hint, which is paid for*, and a
// soft 25% glow is a haze this direction does not have. Focus is `accent-line`,
// the colour reserved for it, drawn as a hard ring.
//
// A colour change alone was never a focus indicator for anyone who cannot see
// the colour, which is why the ring is the indicator and not an addition to it.
import type { InputHTMLAttributes } from 'react';

import { cn } from '../cn.js';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type ?? 'text'}
      className={cn(
        'w-full rounded-none border-3 border-line-strong bg-surface px-3 py-2',
        'text-sm text-ink placeholder:text-muted-2',
        'outline-none',
        'focus-visible:ring-[3px] focus-visible:ring-accent-line focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    />
  );
}
