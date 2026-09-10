// The shop — step H.7.
//
// A **server** component holding the stock, with one client component per row
// for the button. The same shape `/quests` and `/profile` have and for the same
// reason: the shop is three reads keyed by the session's own user id, so no
// endpoint exists whose job is to hand a player's shop to a browser. The routes
// H.7 adds are the ones that *write*.
//
// **A cosmetic carries no prose**, which H.5 decided, so every name here comes
// out of the catalogue keyed by the identifier — including the default's, which
// is a sentence rather than a noun because "nothing" needs explaining.
//
// The preview is the real thing. A marker swatch is the same hex the paragraph
// token draws with and a frame is the same border classes the leaderboard puts
// round a pseudonym, both out of `@wikifake/ui` — because a shop that showed an
// approximation of what you were buying would be a shop that can lie.
import { frameFor, markerColourFor } from '@wikifake/ui';
import { COSMETIC_SLOTS, type CosmeticSlot } from '@wikifake/domain';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { ItemButton, type ItemAction } from './item-button.js';
import type { ShopView, StockItem } from './stock.js';

export interface ShopScreenProps {
  readonly shop: ShopView;
}

/** What a row offers. Decided here, from facts the server read. */
function actionFor(item: StockItem): ItemAction | null {
  if (item.worn) return 'takeOff';
  if (item.owned) return 'wear';
  return item.affordable ? 'buy' : null;
}

/**
 * What the thing looks like, drawn with the design system's own answer.
 *
 * A marker is a filled square in its hex; a frame is the border round a word; a
 * mark style is the marked bar under one. Each is `aria-hidden` where it says
 * nothing a name does not — the row's name is the label, and a swatch nobody can
 * see is not information a screen reader is missing.
 */
function Preview({ item }: { readonly item: StockItem }) {
  const t = useTranslations('shop');
  const name = t(`names.${item.id}`);

  if (item.slot === 'marker') {
    return (
      <span
        aria-hidden
        className="inline-block size-5 border-3 border-line-strong"
        style={{ backgroundColor: markerColourFor(item.id) ?? undefined }}
      />
    );
  }

  if (item.slot === 'frame') {
    return (
      <span aria-hidden className={frameFor(item.id)}>
        {name}
      </span>
    );
  }

  // A mark style, shown on a word rather than in the abstract: the decoration is
  // the whole product, and a rectangle on its own says nothing about it.
  return (
    <span aria-hidden className="relative inline-block px-1">
      {name}
      <span className="pointer-events-none absolute inset-x-1 -bottom-0.5 h-1 bg-accent" />
    </span>
  );
}

function ItemRow({ item }: { readonly item: StockItem }) {
  const t = useTranslations('shop');
  const action = actionFor(item);

  return (
    <li className="flex flex-wrap items-center gap-3 border-3 border-line-strong bg-surface px-3 py-2 shadow-md">
      <Preview item={item} />
      <span className="text-sm text-ink">{t(`names.${item.id}`)}</span>

      <span className="ml-auto flex flex-wrap items-center gap-3">
        {/* The price disappears once it is owned: a number beside something you
            already have is a number that invites the wrong arithmetic. */}
        {item.owned ? (
          <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
            {item.worn ? t('worn') : ''}
          </span>
        ) : (
          <span className="font-mono text-sm tabular-nums text-muted">
            {t('price', { count: item.price })}
          </span>
        )}

        {action === null ? (
          // Not a disabled button. A control that cannot be used is a control
          // that has to explain itself, and "Not enough coins" says the thing a
          // greyed-out *Buy* only implies.
          <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
            {t('tooDear')}
          </span>
        ) : (
          <ItemButton cosmeticId={item.id} slot={item.slot} action={action} />
        )}
      </span>
    </li>
  );
}

function SlotSection({
  slot,
  items,
}: {
  readonly slot: CosmeticSlot;
  readonly items: readonly StockItem[];
}) {
  const t = useTranslations('shop');
  const mine = items.filter((item) => item.slot === slot);

  return (
    <section aria-labelledby={`shop-${slot}`} className="mt-8">
      <h2
        id={`shop-${slot}`}
        className="font-mono text-xs tracking-[0.12em] text-muted uppercase"
      >
        {t(`slots.${slot}`)}
      </h2>
      <p className="mt-1 max-w-prose text-sm text-muted">{t(`slotLead.${slot}`)}</p>

      <ul className="mt-3 space-y-2">
        {mine.map((item) => (
          <ItemRow key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

export function ShopScreen({ shop }: ShopScreenProps) {
  const t = useTranslations('shop');

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-10">
      <h1 className="text-center text-3xl text-ink">{t('title')}</h1>
      <p className="mx-auto mt-2 max-w-prose text-center text-sm text-muted">
        {t('lead')}
      </p>

      {/* The balance, from the ledger. Said once, at the top, because every
          price below is read against it. */}
      <p className="mt-6 text-center font-mono text-lg tabular-nums text-ink">
        {t('balance', { count: shop.balance })}
      </p>
      <p className="mt-2 text-center text-sm text-muted">
        <Link href="/play" className="text-ink underline">
          {t('earn')}
        </Link>
        {' · '}
        <Link href="/quests" className="text-ink underline">
          {t('quests')}
        </Link>
      </p>

      {COSMETIC_SLOTS.map((slot) => (
        <SlotSection key={slot} slot={slot} items={shop.items} />
      ))}

      {/* What every player has and cannot lose — H.5 refused a free catalogue
          entry, so the default is not a row above and needs saying here. */}
      <p className="mt-8 text-center text-sm text-muted">{t('default')}</p>
    </main>
  );
}
