// The button's classes, on their own side of the client boundary.
//
// Split out of `button.tsx` in step 10.0, for a reason the front door found: a
// `'use client'` module exports client things, and Next refuses to *call* one
// from a Server Component — even a pure function that returns a string. The
// landing page of C7.3 is server-rendered and styles a `<Link>` as the primary
// button, which is a call, and the build failed on it.
//
// So the styling lives here, where both sides can read it, and `button.tsx`
// imports it like any other consumer. This is not a second copy: it is the only
// copy, moved. A page that spelled the classes out instead would have been the
// second copy, and the duplicated truths are what the rewrite exists to remove.
import { cva } from 'class-variance-authority';

import { cn } from '../cn.js';

// The button, in the four shapes the current game uses.
//
// `.btn`, `.btn.primary`, `.btn.ghost` and `.btn-icon` of `ui.css`, transcribed:
// the same pill, the same hairline, the same lift on hover, the same fade when
// disabled.
//
// The focus ring is the visible one, deliberately. `outline: none` with nothing
// in its place is the single most common way a design system becomes unusable
// by keyboard, and this one is checked by a test rather than by eye.
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
