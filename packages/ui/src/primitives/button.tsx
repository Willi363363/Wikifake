'use client';

// A client component, every one of them.
//
// Radix reads the DOM — focus, keyboard, portals — and Next needs to be told
// before it tries to render one on the server. Marked on all of them rather
// than only the ones that need it today: a primitive that grows a handler and
// forgets the directive fails at build time in the application, a long way from
// here.

// The button, in the four shapes the current game uses.
//
// `.btn`, `.btn.primary`, `.btn.ghost` and `.btn-icon` of `ui.css`, transcribed:
// the same pill, the same hairline, the same lift on hover, the same fade when
// disabled. What changes is that it is a `<button>`. The current game builds
// several of its buttons out of `<span onClick>`, which is not focusable, not
// reachable by tab, and does nothing on Enter or Space.
//
// The focus ring is the visible one, deliberately. `outline: none` with nothing
// in its place is the single most common way a design system becomes unusable
// by keyboard, and this one is checked by a test rather than by eye.
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';

import { cn } from '../cn.js';

export const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full',
    'font-medium tracking-tight transition-all duration-150',
    // The ring is offset from the control so it reads on a dark and a light
    // ground alike, which the current inline styles have no answer for.
    'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    'disabled:pointer-events-none disabled:opacity-40',
  ),
  {
    variants: {
      variant: {
        default: cn(
          'border border-line-strong bg-surface text-ink',
          'hover:-translate-y-px hover:bg-bg-grain hover:shadow-sm',
          'active:translate-y-0',
        ),
        primary: cn(
          'border border-accent bg-accent text-surface',
          'hover:-translate-y-px hover:brightness-90 hover:shadow-md',
          'active:translate-y-0',
        ),
        ghost: cn(
          'border border-line bg-transparent text-ink-2',
          'hover:border-line-strong hover:bg-bg-grain hover:text-ink',
        ),
        danger: cn(
          'border border-danger bg-danger-soft text-danger',
          'hover:-translate-y-px hover:shadow-sm',
          'active:translate-y-0',
        ),
      },
      size: {
        default: 'px-4 py-2 text-[13px]',
        lg: 'px-5 py-2.5 text-sm',
        /** `.btn-icon`: square, so a lone glyph is not a lopsided pill. */
        icon: 'size-9 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

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
