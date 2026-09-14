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
// **L.6 rewrote the gesture.** Track A's button carried a hard offset shadow at
// rest and moved *into* it on hover — a frame sliding onto its own outline. The
// direction that made that mean something is the one the owner rejected, and a
// 3px frame on a J2 tile is a black rectangle on a soft card.
//
// So the resting state is flat and the hover is a small lift: a shadow that was
// not there, and one pixel of travel. It is the opposite motion of the one it
// replaces, and it is the one that agrees with the elevations — a shadow here
// says *this is over the page*, which is what a control being pressed is about
// to stop being. Pressing puts it back down.
//
// The focus ring is `accent-line`, which is what that token now means. It is
// deliberately the one colour used for nothing else — a focus indicator that
// shares a hue with a state is a focus indicator you have to think about. It is
// the one thing on this button L.6 did not touch: the direction changed, the
// accessibility guarantee did not.
//
// `outline: none` with nothing in its place is the single most common way a
// design system becomes unusable by keyboard, and a test holds this one rather
// than an eye.
export const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md',
    'font-semibold tracking-tight',
    // The three the lift touches, and nothing else, so the transition cannot
    // quietly start animating a size somebody adds later.
    'transition-[transform,box-shadow,background-color] duration-150 ease-[cubic-bezier(.2,.9,.3,1)]',
    'motion-reduce:transition-none',
    'outline-none focus-visible:ring-[3px] focus-visible:ring-accent-line focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    // Disabled is a *style*, not a translucency.
    //
    // It used to be `disabled:opacity-40`, and that was the one fade in a
    // direction that fades nothing: it composited the fill against the page and
    // the text with it, so a submitted button read as grey on cream —
    // recognisably off, and only just legible. Worse, nothing could measure it:
    // `CONTRAST_PAIRS` measures two declared tokens, and an opacity composite is
    // neither of them.
    //
    // A flat recessed fill and no lift say "not now" without fading anything.
    // Both colours are tokens, so `muted` on `bg-grain` is a row of the audit
    // rather than a composite nobody can compute. It is the one part of the old
    // button L.6 kept verbatim, because it was never about the frame.
    'disabled:pointer-events-none disabled:bg-bg-grain disabled:text-muted',
    'disabled:translate-y-0 disabled:shadow-none',
  ),
  {
    variants: {
      variant: {
        /*
         * The secondary control: a tint, not a frame.
         *
         * `bg-grain` is a step off `surface` in both palettes — down in the
         * dark, up in the light — and `line` is a step further in the same
         * direction, so the hover reads as *more* of whatever the rest already
         * was. A bordered button would have been the other answer and it is the
         * one J2 was chosen over: a card with no hairline cannot carry a
         * hairlined control without the control becoming the loudest thing on
         * it.
         */
        default: 'bg-bg-grain text-ink hover:bg-line',
        /*
         * `text-on-fill`, and this is the line the whole palette was built
         * around.
         *
         * It used to read `bg-accent text-surface`, which was right while the
         * accent was a dark teal — paper on it measured about seven to one.
         * Neither of the two accents since has been that kind of colour, and
         * `ink` is no help: in the dark palette it *is* paper, and paper on
         * #6a97f9 is 2.41.
         *
         * So the text on a fill is `on-fill`, decided once per palette against
         * the fill beneath it, and `CONTRAST_PAIRS` measures exactly this pair
         * at 5.86 light and 6.95 dark.
         */
        primary: cn(
          'bg-accent text-on-fill',
          'hover:-translate-y-px hover:shadow-md active:translate-y-0 active:shadow-sm',
        ),
        /** Nothing at rest, so there is no lift to give it: it stays put. */
        ghost: 'bg-transparent text-ink-2 hover:bg-bg-grain hover:text-ink',
        danger: cn(
          'bg-danger text-on-fill',
          'hover:-translate-y-px hover:shadow-md active:translate-y-0 active:shadow-sm',
        ),
      },
      size: {
        default: 'px-4 py-2 text-[13px]',
        lg: 'rounded-lg px-5 py-2.5 text-sm',
        /** Square, so a lone glyph is not a lopsided rectangle. */
        icon: 'size-9 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);
