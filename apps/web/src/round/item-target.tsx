'use client';

// Who to throw it at.
//
// The other half of the chain that was never wired. A real dialog, from step
// 6.2: the current picker is a fixed `<div>` over an overlay `<div>` with a
// `<div onClick>` per rival, so tab walks behind it, Escape does nothing, and
// the selection is announced to nobody.
//
// The caster is not in the list, and the server refuses them anyway
// (`invalid_target`, D6). Both, because a client that offers an illegal move is
// a client that wastes the player's item on a refusal.
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@wikifake/ui';
import type { ItemInstance } from '@wikifake/protocol';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ITEM_BLURB_VALUES, labelFor } from './item-labels.js';

export interface ItemTargetProps {
  /** The item awaiting a target, or null when nothing is being thrown. */
  readonly item: ItemInstance | null;
  /** Everyone but the caster. */
  readonly rivals: readonly string[];
  onConfirm(item: ItemInstance, targets: readonly string[]): void;
  onCancel(): void;
}

export function ItemTarget({ item, rivals, onConfirm, onCancel }: ItemTargetProps) {
  const t = useTranslations('round');
  const [chosen, setChosen] = useState<string | null>(null);
  const label = item === null ? null : labelFor(item.itemId);

  return (
    <Dialog
      open={item !== null}
      onOpenChange={(next) => {
        if (next) return;
        setChosen(null);
        onCancel();
      }}
    >
      <DialogContent>
        <DialogTitle>
          {label === null
            ? t('itemTarget.titleFallback')
            : t('itemTarget.title', {
                icon: label.icon,
                name: t(`items.${label.key}.name`),
              })}
        </DialogTitle>
        <DialogDescription>
          {label === null ? '' : t(`items.${label.key}.blurb`, ITEM_BLURB_VALUES)}
        </DialogDescription>

        {rivals.length === 0 ? (
          <p className="mt-5 text-center text-sm text-muted">
            {t('itemTarget.noRivals')}
          </p>
        ) : (
          <ul
            className="mt-5 space-y-2"
            role="radiogroup"
            aria-label={t('itemTarget.radiogroupAria')}
          >
            {rivals.map((rival) => (
              <li key={rival}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={chosen === rival}
                  onClick={() => {
                    setChosen(rival);
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left transition-colors',
                    'outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    chosen === rival
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-line bg-surface text-ink hover:border-line-strong',
                  )}
                >
                  {rival}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex gap-2">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={() => {
              setChosen(null);
              onCancel();
            }}
          >
            {t('itemTarget.cancel')}
          </Button>
          <Button
            variant="primary"
            className="flex-[2]"
            disabled={chosen === null || item === null}
            onClick={() => {
              if (item === null || chosen === null) return;
              onConfirm(item, [chosen]);
              setChosen(null);
            }}
          >
            {/* Two whole messages, not one derived from the other: word order
                around the name is the translation's decision. */}
            {chosen === null
              ? t('itemTarget.throw')
              : t('itemTarget.throwAt', { rival: chosen })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
