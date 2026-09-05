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
// The badges are **content** rather than `::before`/`::after`. A
// pseudo-element's `content` is inconsistently exposed to assistive technology
// and cannot be translated at all, which is how `"🔎 INDICE"` came to be French
// text living inside a stylesheet.
//
// Step B.8 gave the states the brutalist grammar and left the prose alone,
// which is the whole of `01-art-direction.md`'s exemption in one component:
// **the text is calm, the act of marking it is loud.** At rest there is no
// border, no fill and no shadow — only the crosshair says the paragraph can be
// marked. Marked, it takes the structural border and a wash.
//
// The border is `border-3 border-transparent` at rest rather than absent, so
// that the box is the same size before and after: a border that appears on
// hover and reflows the paragraph under the cursor is a paragraph that is hard
// to click and impossible to read while choosing.
//
// The three bronze states are told apart by border *style* rather than by a
// fourth shade of the same hue — dashed for edited, dotted for scanned, solid
// for hinted. That is one more thing that survives being seen in grey.
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '../cn.js';
import { isInteractive, TOKEN_LABELS, type TokenState } from './state.js';

export const tokenVariants = cva(
  cn(
    'relative block w-full rounded-token border-3 px-1 py-0.5 text-left',
    // Wikipedia prose carries chemical names, German compounds and bare URLs.
    // Without this a single word decides the width of the page, and at 360 CSS
    // pixels that is a page which scrolls sideways.
    'break-words hyphens-auto',
    'transition-[background-color,border-color] duration-150 motion-reduce:transition-none',
  ),
  {
    variants: {
      state: {
        // Nothing at all, which is the exemption. The crosshair is the only
        // thing that says this paragraph is markable, and that is enough while
        // the player is reading rather than deciding.
        idle: cn(
          'cursor-crosshair border-transparent bg-transparent text-ink',
          'hover:border-line-strong',
        ),
        selected: cn(
          'cursor-crosshair border-line-strong bg-accent-soft text-ink',
          'animate-token-flash',
        ),
        edited: cn(
          'cursor-crosshair border-dashed border-line-strong bg-bronze-soft text-ink',
        ),
        scanned: cn(
          'cursor-crosshair border-dotted border-line-strong bg-bronze-soft text-ink',
        ),
        hinted: cn('cursor-crosshair border-line-strong bg-bronze-soft text-ink'),
        found: 'cursor-default border-line-strong bg-green-soft text-ink',
        missed: 'cursor-default border-line-strong bg-warn-soft text-ink',
        // Line-through as well as colour, and now in `ink` rather than in a
        // tint of `danger`: three verdicts told apart by hue alone is three
        // verdicts nobody colour-blind can tell apart.
        'false-positive': cn(
          'cursor-default border-line-strong bg-danger-soft text-ink',
          'line-through decoration-ink decoration-2',
        ),
      },
      interactive: {
        true: cn(
          'outline-none',
          'focus-visible:ring-[3px] focus-visible:ring-accent-line focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
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
            'pointer-events-none absolute inset-0 rounded-token',
            // Still a gradient, and the direction has none. It stays for one
            // more step because the fix is in the keyframe rather than here:
            // `scan-sweep` translates the element by its own width, so a solid
            // bar would travel four pixels and stop. Step B.9 moves the bar in
            // the stylesheet and this becomes a block of `bronze`.
            'bg-linear-to-r from-transparent via-bronze/20 to-transparent',
            'animate-scan-sweep',
          )}
        />
      ) : null}

      {/* The marked underline: `.token.selected::after`. */}
      {shown === 'selected' ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-1 -bottom-0.5 h-1 bg-accent"
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
                  // `text-surface` here was paper on a fill, exactly the pair
                  // the primary button carried: white on #5fe08b is about
                  // 1.7:1. `on-fill` is what the audit measures at 12.52.
                  '-top-2 -right-1 flex size-3.5 items-center justify-center',
                  'border-2 border-line-strong text-[9px] text-on-fill',
                  shown === 'found' ? 'bg-green' : 'bg-warn',
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
