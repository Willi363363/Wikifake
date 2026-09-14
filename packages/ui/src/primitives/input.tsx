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
// The bronze focus glow is gone. It was the identity before track A, and it says
// the wrong thing twice over: `bronze` means *a hint, which is paid for*, and a
// soft 25% glow is a haze neither direction has. Focus is `accent-line`, the
// colour reserved for it, drawn as a hard ring — unchanged by L.6, because the
// direction changed and the accessibility guarantee did not.
//
// A colour change alone was never a focus indicator for anyone who cannot see
// the colour, which is why the ring is the indicator and not an addition to it.
//
// **This is one of the few things J2 still draws a border on**, and the reason
// is that a field is the one control whose shape has to be visible before it
// contains anything. A tile separates from the page by being a different
// surface; an empty input separating the same way is a rectangle of paper on
// paper. So it keeps an edge, at `line-strong` — which is now what that token is
// for — and it is a hairline rather than the 3px frame it used to be.
import type { InputHTMLAttributes } from 'react';

import { cn } from '../cn.js';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type ?? 'text'}
      className={cn(
        'w-full rounded-md border border-line-strong bg-surface px-3 py-2',
        'text-sm text-ink placeholder:text-muted-2',
        'outline-none',
        'focus-visible:ring-[3px] focus-visible:ring-accent-line focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        // The same disabled vocabulary as the button: a flat fill and
        // withdrawn text, both of them tokens the audit can measure.
        'disabled:cursor-not-allowed disabled:bg-bg-grain disabled:text-muted',
        className,
      )}
      {...props}
    />
  );
}
