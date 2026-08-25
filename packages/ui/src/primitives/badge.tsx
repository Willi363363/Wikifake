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

export const badgeVariants = cva(
  cn(
    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
    'font-mono text-[10px] font-medium tracking-[0.12em] uppercase',
  ),
  {
    variants: {
      tone: {
        neutral: 'border-line-strong bg-surface text-ink',
        accent: 'border-accent-line bg-accent-soft text-accent',
        bronze: 'border-bronze/25 bg-bronze-soft text-bronze',
        green: 'border-green/25 bg-green-soft text-green',
        warn: 'border-warn/25 bg-warn-soft text-warn',
        danger: 'border-danger/25 bg-danger-soft text-danger',
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
