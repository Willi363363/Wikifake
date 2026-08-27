'use client';

// The paragraph token: the central gesture of the game.
//
// Today it is a `<span onClick>`. It cannot be reached by tab, it has no role,
// it does nothing on Enter or Space, and nothing announces whether it is marked.
// The whole game is clicking these, so the whole game is unplayable without a
// mouse — which is not a rough edge, it is the thing itself.
//
// So it is a `<button>` while the round runs, and a `<p>` once it is over. The
// verdicts are not actions: the current stylesheet says as much with
// `cursor: default`, and a control that looks pressable and does nothing is
// worse than one that does not look pressable.
//
// The looks are `article.css`, transcribed — the same washes, the same inset
// hairlines, the same crosshair, the same 360ms flash on marking, the same
// sweep on a bought hint. What changes is that the badges are **content**
// instead of `::before`/`::after`. A pseudo-element's `content` is
// inconsistently exposed to assistive technology and cannot be translated at
// all, which is how `"🔎 INDICE"` came to be French text living inside a
// stylesheet.
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '../cn.js';
import { isInteractive, TOKEN_LABELS, type TokenState } from './state.js';

export const tokenVariants = cva(
  cn(
    'relative block w-full rounded-sm px-1 py-0.5 text-left',
    // Wikipedia prose carries chemical names, German compounds and bare URLs.
    // Without this a single word decides the width of the page, and at 360 CSS
    // pixels that is a page which scrolls sideways.
    'break-words hyphens-auto',
    'transition-[background-color,color,box-shadow] duration-150',
  ),
  {
    variants: {
      state: {
        idle: cn(
          'cursor-crosshair bg-transparent text-ink',
          'hover:bg-accent/7 hover:shadow-[inset_0_0_0_1px_var(--color-accent-line)]',
        ),
        selected: cn(
          'cursor-crosshair bg-accent-soft text-accent',
          'shadow-[inset_0_0_0_1px_var(--color-accent-line)]',
          'animate-token-flash',
        ),
        edited: cn(
          'cursor-crosshair bg-bronze-soft text-bronze',
          'shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-bronze)_25%,transparent)]',
        ),
        scanned: cn(
          'cursor-crosshair bg-bronze/15 text-ink',
          'shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-bronze)_30%,transparent)]',
        ),
        hinted: cn(
          'cursor-crosshair bg-bronze-soft text-bronze',
          'shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-bronze)_25%,transparent)]',
        ),
        found: cn(
          'cursor-default bg-green-soft text-green',
          'shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-green)_32%,transparent)]',
        ),
        missed: cn(
          'cursor-default bg-warn-soft text-warn',
          'shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-warn)_32%,transparent)]',
        ),
        // Line-through as well as colour: three verdicts told apart by hue alone
        // is three verdicts nobody colour-blind can tell apart.
        'false-positive': cn(
          'cursor-default bg-danger-soft text-danger line-through decoration-1',
          'decoration-danger/60',
          'shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-danger)_30%,transparent)]',
        ),
      },
      interactive: {
        true: cn(
          'outline-none',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        ),
        false: '',
      },
    },
    defaultVariants: { state: 'idle', interactive: true },
  },
);

/** The badge each state wears, if any. Decoration; the label carries the sense. */
const GLYPH: Partial<Record<TokenState, string>> = {
  found: '✓',
  missed: '!',
  scanned: '🔎',
};

export interface ParagraphTokenProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    Omit<VariantProps<typeof tokenVariants>, 'interactive'> {
  readonly children: ReactNode;
  /**
   * What the state is called. Defaults to the English of `TOKEN_LABELS`.
   *
   * A prop rather than a constant read inside, so phase 11 translates it without
   * touching this file — and `null` for a state that says nothing.
   */
  readonly label?: string | null;
}

export function ParagraphToken({
  className,
  state,
  label,
  children,
  disabled,
  ...props
}: ParagraphTokenProps) {
  const shown: TokenState = state ?? 'idle';
  const live = isInteractive(shown) && disabled !== true;
  const said = label === undefined ? TOKEN_LABELS[shown] : label;
  const glyph = GLYPH[shown];

  const body = (
    <>
      {children}

      {/* The sweep of a bought hint: `.token.hinted::before` in the current
          stylesheet, and one of the seven `prefers-reduced-motion` switches
          off. Decorative, so it is hidden and it is not a child of the text. */}
      {shown === 'hinted' ? (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 rounded-sm',
            'bg-linear-to-r from-transparent via-bronze/20 to-transparent',
            'animate-scan-sweep',
          )}
        />
      ) : null}

      {/* The marked underline: `.token.selected::after`. */}
      {shown === 'selected' ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-1 -bottom-0.5 h-0.5 rounded-sm bg-accent"
        />
      ) : null}

      {glyph === undefined ? null : (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute font-mono font-bold',
            shown === 'scanned'
              ? '-top-5 left-0 text-[10px] text-bronze'
              : cn(
                  '-top-2 -right-1 flex size-3 items-center justify-center rounded-full',
                  'text-[9px] text-surface',
                  shown === 'found' ? 'bg-green shadow-sm' : 'bg-warn',
                ),
          )}
        >
          {glyph}
        </span>
      )}

      {/* The meaning, in words. The glyph above is decoration; this is what a
          screen reader says, and what phase 11 translates. */}
      {said === null ? null : <span className="sr-only"> — {said}</span>}
    </>
  );

  if (!live) {
    return (
      <p
        data-state={shown}
        className={cn(tokenVariants({ state: shown, interactive: false }), className)}
      >
        {body}
      </p>
    );
  }

  return (
    <button
      type="button"
      // The gesture is a toggle, and this is what says so out loud. `edited`
      // counts as marked: a paragraph with a correction typed into it is a
      // paragraph the player is accusing.
      aria-pressed={shown === 'selected' || shown === 'edited'}
      data-state={shown}
      className={cn(tokenVariants({ state: shown, interactive: true }), className)}
      {...props}
    >
      {body}
    </button>
  );
}
