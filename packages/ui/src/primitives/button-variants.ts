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

// The button, in the four shapes the game uses.
//
// The interaction *is* the direction: at rest the button carries a hard offset
// shadow, and on hover it moves into it — `translate` by exactly the shadow's
// own 4px, shadow to none. Nothing else moves, nothing fades, nothing lifts.
// The old lift-and-glow was the previous identity and it has no meaning here:
// this direction does not float things, so it cannot raise one.
//
// The focus ring is `accent-line`, which is what that token now means. It is
// deliberately the one colour used for nothing else — a focus indicator that
// shares a hue with a state is a focus indicator you have to think about.
//
// `outline: none` with nothing in its place is the single most common way a
// design system becomes unusable by keyboard, and a test holds this one rather
// than an eye.
export const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-none',
    'font-bold tracking-tight',
    // Only the two properties the collapse touches, so the transition cannot
    // quietly start animating a colour or a size somebody adds later.
    'transition-[transform,box-shadow] duration-150 ease-[cubic-bezier(.2,.9,.3,1)]',
    'motion-reduce:transition-none',
    'outline-none focus-visible:ring-[3px] focus-visible:ring-accent-line focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    'disabled:pointer-events-none disabled:opacity-40',
  ),
  {
    variants: {
      variant: {
        default: cn(
          'border-3 border-line-strong bg-surface text-ink shadow-md',
          'hover:translate-x-1 hover:translate-y-1 hover:shadow-none',
        ),
        /*
         * `text-on-fill`, and this is the line the whole palette was built
         * around.
         *
         * It used to read `bg-accent text-surface`, which was right while the
         * accent was a dark teal — paper on it measured about seven to one. The
         * brutalist accent is #ffe14d, and paper on that is **1.30:1**. `ink`
         * would be no better in the dark palette, where it *is* paper.
         *
         * So the text on a fill is `on-fill`, black on either ground, and
         * `CONTRAST_PAIRS` measures exactly this pair at 16.13:1.
         */
        primary: cn(
          'border-3 border-line-strong bg-accent text-on-fill shadow-md',
          'hover:translate-x-1 hover:translate-y-1 hover:shadow-none',
        ),
        /** No shadow, so there is nothing to collapse into: it stays put. */
        ghost: cn(
          'border-3 border-transparent bg-transparent text-ink-2',
          'hover:border-line-strong hover:bg-bg-grain hover:text-ink',
        ),
        danger: cn(
          'border-3 border-line-strong bg-danger text-on-fill shadow-md',
          'hover:translate-x-1 hover:translate-y-1 hover:shadow-none',
        ),
      },
      size: {
        default: 'px-4 py-2 text-[13px]',
        lg: 'px-5 py-2.5 text-sm',
        /** Square, so a lone glyph is not a lopsided rectangle. */
        icon: 'size-9 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);
