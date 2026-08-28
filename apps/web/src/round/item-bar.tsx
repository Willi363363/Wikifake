'use client';

// The hand, along the bottom of the round.
//
// Buttons, and that is the whole of the rebuild's first half: the current bar is
// a `<div onClick>` per card wired to a handler that does not exist. Here every
// card is focusable, says what it is, and says whether it is in flight.
import { cn } from '@wikifake/ui';
import type { ItemInstance } from '@wikifake/protocol';
import { useTranslations } from 'next-intl';

import { ITEM_BLURB_VALUES, isSelfCast, labelFor } from './item-labels.js';

export interface ItemBarProps {
  readonly hand: readonly ItemInstance[];
  /** The instance whose use is in flight, or null. */
  readonly pending: string | null;
  /** True once the round is out of the player's hands. */
  readonly locked: boolean;
  onPick(item: ItemInstance): void;
}

export function ItemBar({ hand, pending, locked, onPick }: ItemBarProps) {
  const t = useTranslations('round');

  // Nothing to spend, nothing on screen. The bar is fixed, and an empty fixed
  // bar is a strip of furniture over the article.
  if (hand.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-2 pb-3">
      <div
        // A toolbar, so a screen reader announces a group and arrow keys are
        // expected to move within it.
        role="toolbar"
        aria-label={t('items.barAria')}
        aria-orientation="horizontal"
        className="flex max-w-full items-center gap-2 overflow-x-auto rounded-2xl border border-line bg-glass-strong px-3 py-2 shadow-lg backdrop-blur-md"
      >
        <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
          {t('items.barLabel')}
        </span>
        {hand.map((item) => {
          const label = labelFor(item.itemId);
          const name = t(`items.${label.key}.name`);
          const blurb = t(`items.${label.key}.blurb`, ITEM_BLURB_VALUES);
          const inFlight = pending === item.instanceId;

          return (
            <button
              key={item.instanceId}
              type="button"
              // Something in flight disables the lot: one use at a time is what
              // lets a refusal be attributed to the item that caused it.
              disabled={locked || pending !== null}
              onClick={() => {
                onPick(item);
              }}
              // The name and what it does, both: a bar of glyphs is a bar
              // nobody can read, and `title` is not available to a keyboard.
              // Two whole messages rather than an appended fragment: the
              // "asks for a target" clause moves with the language.
              aria-label={
                isSelfCast(item.itemId)
                  ? t('items.cardAria', { name, blurb })
                  : t('items.cardAriaTargeted', { name, blurb })
              }
              className={cn(
                'flex min-w-[4.5rem] flex-col items-center gap-1 rounded-xl border px-3 py-2 transition-all',
                'outline-none focus-visible:ring-2 focus-visible:ring-accent',
                'enabled:hover:-translate-y-px enabled:hover:shadow-md',
                'disabled:opacity-50',
                inFlight ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
              )}
            >
              <span aria-hidden="true" className="text-xl">
                {label.icon}
              </span>
              <span className="font-mono text-[9px] tracking-[0.1em] text-muted uppercase">
                {name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
