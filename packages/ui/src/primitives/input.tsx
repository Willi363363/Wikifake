'use client';

// A client component, every one of them.
//
// Radix reads the DOM — focus, keyboard, portals — and Next needs to be told
// before it tries to render one on the server. Marked on all of them rather
// than only the ones that need it today: a primitive that grows a handler and
// forgets the directive fails at build time in the application, a long way from
// here.

// The text field. `.expert-input` of `ui.css`, transcribed.
//
// The bronze focus glow is kept — it is the identity — and a real focus ring is
// added beside it: a glow is a colour change, and a colour change is not a focus
// indicator for anyone who cannot see the colour.
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
        'transition-shadow duration-150 outline-none',
        'focus-visible:border-bronze focus-visible:ring-2 focus-visible:ring-bronze/25',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    />
  );
}
