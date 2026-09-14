'use client';

// A client component, every one of them.
//
// Radix reads the DOM — focus, keyboard, portals — and Next needs to be told
// before it tries to render one on the server. Marked on all of them rather
// than only the ones that need it today: a primitive that grows a handler and
// forgets the directive fails at build time in the application, a long way from
// here.

// The chip: a small uppercase pill for a status, a mode, a hint's price.
//
// `components/ui/Chip.jsx`, which took its colours as three free-form CSS
// strings — `color`, `bg` and `border` — so every call site invented its own
// palette and nothing could be checked. Here the accents are the variants, and a
// colour outside the theme is not expressible.
import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '../cn.js';

/*
 * Every tone is a solid fill carrying `on-fill`, and since L.6 the fill is all
 * there is.
 *
 * It used to be a wash behind text of the accent's own colour, with a border
 * derived from it at 25%, and that shape did not survive track A. Two reasons,
 * and the second is the load-bearing one:
 *
 *  - a border expressed as `border-green/25` is a colour nobody declared and
 *    nothing measures, which is how a palette drifts one convenience at a time;
 *  - `text-green` on `bg-green-soft` was a declared pair *because the accents
 *    were text colours*. They are fills now, and the pair `CONTRAST_PAIRS`
 *    measures is `on-fill` on the fill itself.
 *
 * What L.6 took off is the 3px frame around all six. A chip is the smallest
 * object on a screen and it was carrying the heaviest edge on it; in J2 the
 * fill is already the whole of the chip, and a frame around a fill is an
 * outline of a shape that is not in doubt.
 *
 * `neutral` is the one that had to change colour rather than lose a border:
 * `bg-surface` on a surface card with no frame is not a chip, it is a word. It
 * is the recessed ground instead, which is the same tint the secondary button
 * uses for the same reason.
 */
export const badgeVariants = cva(
  cn(
    'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5',
    'font-mono text-[10px] font-bold tracking-[0.12em] uppercase',
  ),
  {
    variants: {
      tone: {
        neutral: 'bg-bg-grain text-ink-2',
        accent: 'bg-accent text-on-fill',
        bronze: 'bg-bronze text-on-fill',
        green: 'bg-green text-on-fill',
        warn: 'bg-warn text-on-fill',
        danger: 'bg-danger text-on-fill',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
