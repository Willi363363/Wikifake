'use client';

// The one control on a shop row — step H.7.
//
// A client component because it posts and then has to say what happened, and the
// smallest thing that can be one: the catalogue, the prices and every row's
// state stay on the server, so a browser is handed a shop rather than a query.
// The same shape `ClaimButton` has, for the same reasons.
//
// **It refreshes rather than re-rendering itself.** `router.refresh()` re-runs
// the server component, which re-reads the ledger and the worn columns — so the
// balance and the button a player sees afterwards are the database's answer and
// not this component's optimism. An optimistic update would be a second opinion
// about whether coins were spent, and the ledger exists precisely so that
// question has one answer.
import { Button } from '@wikifake/ui';
import type { CosmeticId, CosmeticSlot } from '@wikifake/domain';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** What this row's button does, decided on the server by `readShop`. */
export type ItemAction = 'buy' | 'wear' | 'takeOff';

export interface ItemButtonProps {
  readonly cosmeticId: CosmeticId;
  readonly slot: CosmeticSlot;
  readonly action: ItemAction;
}

/** The refusals this screen has a sentence for. */
const REFUSALS = [
  'insufficient_coins',
  'cosmetic_not_found',
  'cosmetic_not_owned',
  'session_not_found',
] as const;

function refusalIn(body: unknown): (typeof REFUSALS)[number] | null {
  const code = (body as { code?: unknown } | null)?.code;
  return REFUSALS.find((known) => known === code) ?? null;
}

export function ItemButton({ cosmeticId, slot, action }: ItemButtonProps) {
  const t = useTranslations('shop');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  const act = (): void => {
    if (busy) return;
    setBusy(true);
    setRefused(null);

    // Two endpoints, and which one is decided by what the row offers rather
    // than by a flag: buying spends and wearing does not, so they are separate
    // routes with separate refusals — and H.7 deliberately does not make one
    // call do both.
    const [path, body] =
      action === 'buy'
        ? ['/api/shop/buy', { cosmeticId }]
        : action === 'wear'
          ? ['/api/account/cosmetics', { cosmeticId }]
          : ['/api/account/cosmetics', { slot }];

    void (async () => {
      try {
        const answer = await fetch(path as string, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (answer.ok) {
          // Not `setBusy(false)` first: the refresh replaces this row, and a
          // button that goes back to saying "Buy" for a frame is a button
          // somebody clicks twice.
          router.refresh();
          return;
        }

        const code = refusalIn(await answer.json().catch(() => null));
        // A code this screen knows gets its own sentence; anything else is the
        // unreachable case, because a refusal and a dead connection are
        // different things — telling somebody on a train that they cannot
        // afford something would be a lie.
        setRefused(code === null ? t('errors.unreachable') : t(`errors.${code}`));
        setBusy(false);
      } catch {
        setRefused(t('errors.unreachable'));
        setBusy(false);
      }
    })();
  };

  const label =
    action === 'buy'
      ? busy
        ? t('buying')
        : t('buy')
      : action === 'wear'
        ? busy
          ? t('wearing')
          : t('wear')
        : t('takeOff');

  return (
    <>
      <Button
        variant={action === 'buy' ? 'primary' : 'default'}
        onClick={act}
        disabled={busy}
      >
        {label}
      </Button>
      {refused === null ? null : (
        // A wash with `ink` on it, never a fill used as a text colour.
        <p
          role="alert"
          className="mt-2 border-3 border-line-strong bg-danger-soft px-3 py-2 text-sm text-ink"
        >
          {refused}
        </p>
      )}
    </>
  );
}
