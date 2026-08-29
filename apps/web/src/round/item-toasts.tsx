'use client';

// What just happened to you.
//
// Two things arrive unasked during a round: an item lands on this player
// (`item_effect`), and the SCANNER answers (`scanner_result`). Both are said
// here, in a live region, because a screen where the clock silently loses ten
// seconds is a screen that looks broken.
//
// Dismissible rather than timed. The current stack expires each toast after four
// seconds from inside `useItemEffects`, which is a timer per toast and a reason
// to miss what happened; these stay until they are read. The visual effects
// themselves are step 8.4.
import { Button } from '@wikifake/ui';
import { useTranslations } from 'next-intl';

import { labelFor } from './item-labels.js';
import type { Landed, ScanNotice } from './items.js';

export interface ItemToastsProps {
  readonly landed: readonly Landed[];
  readonly lastScan: ScanNotice | null;
  onDismiss(id: string): void;
}

export function ItemToasts({ landed, lastScan, onDismiss }: ItemToastsProps) {
  const t = useTranslations('round');

  if (landed.length === 0 && lastScan === null) return null;

  return (
    <div
      // Polite, not assertive: an item landing is worth saying and is not worth
      // interrupting somebody mid-sentence.
      aria-live="polite"
      className="fixed top-20 right-3 z-40 flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-2"
    >
      {lastScan === null ? null : (
        <p className="rounded-xl border border-bronze/25 bg-bronze-soft px-4 py-3 text-sm text-bronze shadow-md">
          {lastScan.paragraphIndex === null
            ? // C1.6 — the SCANNER answers `null` once nothing is left. The
              // current server sends nothing at all, so the client cannot tell
              // exhaustion from a lost frame.
              t('toasts.scannerExhausted')
            : t('toasts.scannerResult', { paragraph: lastScan.paragraphIndex })}
        </p>
      )}

      {landed.map((each) => {
        const label = labelFor(each.itemId);
        const itemName = t(`items.${label.key}.name`);
        return (
          <div
            key={each.id}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink shadow-md"
          >
            <span aria-hidden="true" className="text-lg">
              {label.icon}
            </span>
            <p className="flex-1">
              {/* One rich message: the thrower's name is a bold placeholder,
                  because the words around it change order per language. */}
              {t.rich('toasts.itemLanded', {
                itemName,
                from: each.from,
                thrower: (chunks) => <strong className="font-medium">{chunks}</strong>,
              })}
            </p>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('toasts.dismissAria', { itemName, from: each.from })}
              onClick={() => {
                onDismiss(each.id);
              }}
            >
              ✕
            </Button>
          </div>
        );
      })}
    </div>
  );
}
