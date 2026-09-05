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
 * Every tone is a solid fill carrying `on-fill`, and the border is always the
 * structural one.
 *
 * It used to be the other way round — a wash behind text of the accent's own
 * colour, with a border derived from it at 25% — and that shape does not
 * survive the direction. Two reasons, and the second is the load-bearing one:
 *
 *  - a border expressed as `border-green/25` is a colour nobody declared and
 *    nothing measures, which is how a palette drifts one convenience at a time;
 *  - `text-green` on `bg-green-soft` was a declared pair *because the accents
 *    were text colours*. They are fills now, and the pair `CONTRAST_PAIRS`
 *    measures is `on-fill` on the fill itself.
 *
 * A badge is small and uppercase, so it takes the loud half of the palette: the
 * fill, not the wash. The washes belong to a paragraph, which is read.
 */
export const badgeVariants = cva(
  cn(
    'inline-flex items-center gap-1.5 rounded-none border-3 border-line-strong px-2.5 py-1',
    'font-mono text-[10px] font-bold tracking-[0.12em] uppercase',
  ),
  {
    variants: {
      tone: {
        neutral: 'bg-surface text-ink',
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
