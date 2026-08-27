'use client';

// A client component, every one of them.
//
// Radix reads the DOM — focus, keyboard, portals — and Next needs to be told
// before it tries to render one on the server. Marked on all of them rather
// than only the ones that need it today: a primitive that grows a handler and
// forgets the directive fails at build time in the application, a long way from
// here.
//
// The classes are **not** here: they live in `button-variants.ts`, on the other
// side of this directive, because a Server Component styling a `<Link>` as a
// button has to be able to call them. See that file.
//
// The current game builds several of its buttons out of `<span onClick>`, which
// is not focusable, not reachable by tab, and does nothing on Enter or Space.
// What changes here is that it is a `<button>`.
import type { VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';

import { cn } from '../cn.js';

import { buttonVariants } from './button-variants.js';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type, ...props }: ButtonProps) {
  return (
    <button
      // Explicit, because a button inside a form defaults to `submit` and the
      // surprise submission it causes is always found by a player, never by a
      // developer.
      type={type ?? 'button'}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
