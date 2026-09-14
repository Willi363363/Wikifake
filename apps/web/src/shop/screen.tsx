// The shop — step H.7, rearranged into S2 at L.6.
//
// A **server** component holding the stock, with one client component per card
// for the button. The same shape `/quests` and `/profile` have and for the same
// reason: the shop is three reads keyed by the session's own user id, so no
// endpoint exists whose job is to hand a player's shop to a browser. The routes
// H.7 adds are the ones that *write*.
//
// **S2 — one grid, the slot as a label.** It was three stacked sections, one per
// slot, each with a heading and a lead: ten items in three rhythms, and a player
// with forty coins had to read all three to find out what forty coins reached.
// The owner chose the grid for exactly that, so the slot moved onto the card and
// the three leads moved above it, said once.
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
import { COSMETIC_SLOTS } from '@wikifake/domain';
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
        className="inline-block size-5 rounded-md border border-line-strong"
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

function ItemCard({ item }: { readonly item: StockItem }) {
  const t = useTranslations('shop');
  const action = actionFor(item);

  return (
    <li className="flex flex-col gap-3 rounded-xl bg-surface p-5">
      {/* The slot, on the card. In S1 it was a heading three items shared; here
          it is what tells a player that the crimson square and the double border
          are not two versions of the same purchase. */}
      <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
        {t(`slots.${item.slot}`)}
      </span>

      <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <Preview item={item} />
        {t(`names.${item.id}`)}
      </span>

      {/* `mt-auto`, so the action sits on the bottom edge whatever the name
          above it wrapped to. Ten cards whose buttons are at ten heights is a
          grid you cannot scan down. */}
      <span className="mt-auto flex flex-col gap-2">
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

/**
 * What the three kinds are, said once above the grid.
 *
 * These sentences were a lead under each of three headings, and they carry
 * information a card cannot: that the marker is yours *alone*, because a room
 * assigns colours so players can be told apart. S2 has no per-slot section to
 * put them under, and deleting them to fit the arrangement would have been the
 * arrangement editing the product.
 */
function WhatTheSlotsAre() {
  const t = useTranslations('shop');

  return (
    <dl className="m-0 grid gap-4 sm:grid-cols-3">
      {COSMETIC_SLOTS.map((slot) => (
        <div key={slot} className="flex min-w-0 flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
            {t(`slots.${slot}`)}
          </dt>
          <dd className="m-0 text-[13px] leading-relaxed text-ink-2">
            {t(`slotLead.${slot}`)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ShopScreen({ shop }: ShopScreenProps) {
  const t = useTranslations('shop');

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8">
      {/* Left-aligned, not centred. The bar above names the page, so the
          heading is the first line of the document rather than a title card. */}
      <header className="flex flex-col gap-2">
        <h1 className="m-0 text-3xl text-ink">{t('title')}</h1>
        <p className="m-0 max-w-prose text-sm text-muted">{t('lead')}</p>
      </header>

      {/* The balance, from the ledger. Said once, near the top, because every
          price below is read against it. */}
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 rounded-xl bg-surface px-5 py-4">
        <p className="m-0 font-mono text-2xl tabular-nums text-ink">
          {t('balance', { count: shop.balance })}
        </p>
        <p className="m-0 text-sm text-muted">
          <Link href="/play" className="text-accent underline">
            {t('earn')}
          </Link>
          {' · '}
          <Link href="/quests" className="text-accent underline">
            {t('quests')}
          </Link>
        </p>
      </div>

      <WhatTheSlotsAre />

      {/* One grid, every item in it, in the order `readShop` answered — which
          is slot by slot, so the labels still arrive in runs and the grid reads
          as grouped without being three grids. */}
      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {shop.items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </ul>

      {/* What every player has and cannot lose — H.5 refused a free catalogue
          entry, so the default is not a card above and needs saying here. */}
      <p className="m-0 text-sm text-muted">{t('default')}</p>
    </main>
  );
}
