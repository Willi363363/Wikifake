'use client';

// The shop, three arrangements — step L.1, round six.
//
// J2 is settled, so the palette and the surface stop moving: no hairline, a
// tile is separated by being a different surface, flat blue, larger figures.
// What varies is how ten items across three slots are laid out.
//
// **The shop is the page the owner called hardest to reach**, and the bar fixed
// that — it is one click from anywhere now. What it did not fix is the page
// itself: three slots whose items are not comparable to each other, a balance
// that decides what is affordable, and one item worn per slot.
//
// The honest constraint all three obey: **an item you already wear and an item
// you cannot afford must not look alike.** They are the two states a player
// reads first, and the shop is useless if they blur.
import { Shell } from './shell.js';
import type { Copy } from './copy.js';
import { SAMPLE, SHOP, type Item } from './sample.js';
import { FLAT_SKIN, J2 } from './variants.js';
import type { Theme } from './tone.js';
import type { Tone } from './tone.js';

export interface ShopProps {
  readonly copy: Copy;
  readonly theme: Theme;
  readonly onAdminPage: boolean;
}

/** What the player can do with one item, and what it costs to say so. */
function state(item: Item, coins: number): 'worn' | 'owned' | 'buy' | 'tooDear' {
  if (item.worn) return 'worn';
  if (item.owned) return 'owned';
  return item.price <= coins ? 'buy' : 'tooDear';
}

function Swatch({ item, tone }: { readonly item: Item; readonly tone: Tone }) {
  return (
    <span
      style={{ background: item.swatch ?? tone.muted }}
      className="inline-block size-4 shrink-0 rounded-full"
    />
  );
}

function Balance({ copy, tone }: { readonly copy: Copy; readonly tone: Tone }) {
  return (
    <div
      style={{ background: tone.accent, color: tone.onAccent }}
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4"
    >
      <span className="text-[24px] leading-none font-bold tabular-nums">
        {copy.coins(SAMPLE.coins)}
      </span>
      <a href="#" className="text-[13px] font-semibold underline underline-offset-4">
        {copy.earn}
      </a>
    </div>
  );
}

/** S1 — a row per slot, items side by side. The shape the dashboard implies. */
export function ShopRows({ copy, theme, onAdminPage }: ShopProps) {
  const tone = J2[theme];
  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="s1-menu">
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-8 sm:py-8">
        <Balance copy={copy} tone={tone} />

        {SHOP.map((slot) => (
          <section
            key={slot.id}
            style={{ background: tone.surface }}
            className="rounded-2xl p-5"
          >
            <h2 className="m-0 text-[15px] font-bold">{copy.slot(slot.id)}</h2>
            <p style={{ color: tone.muted }} className="m-0 mt-1 max-w-2xl text-[13px]">
              {copy.slotLead(slot.id)}
            </p>
            <ul className="m-0 mt-4 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4">
              {slot.items.map((item) => {
                const how = state(item, SAMPLE.coins);
                return (
                  <li
                    key={item.id}
                    style={{
                      background: how === 'worn' ? tone.accent : tone.bg,
                      color: how === 'worn' ? tone.onAccent : tone.ink,
                    }}
                    className="flex flex-col gap-2 rounded-xl p-3"
                  >
                    <span className="flex items-center gap-2 text-[13.5px] font-semibold">
                      {item.swatch === undefined ? null : (
                        <Swatch item={item} tone={tone} />
                      )}
                      {copy.itemName(item.id)}
                    </span>
                    <span
                      style={{
                        color:
                          how === 'worn'
                            ? tone.onAccent
                            : how === 'tooDear'
                              ? tone.muted
                              : tone.ink,
                      }}
                      className="text-[12.5px]"
                    >
                      {how === 'worn'
                        ? copy.worn
                        : how === 'owned'
                          ? copy.wear
                          : how === 'tooDear'
                            ? copy.tooDear
                            : copy.price(item.price)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
    </Shell>
  );
}

/** S2 — one grid, the slot as a label. Everything comparable at a glance. */
export function ShopGrid({ copy, theme, onAdminPage }: ShopProps) {
  const tone = J2[theme];
  const all = SHOP.flatMap((slot) => slot.items.map((item) => ({ item, slot: slot.id })));
  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="s2-menu">
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-8 sm:py-8">
        <Balance copy={copy} tone={tone} />
        <p
          style={{ color: tone.muted }}
          className="m-0 max-w-2xl text-[13.5px] leading-[1.65]"
        >
          {copy.shopLead}
        </p>

        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-3 lg:grid-cols-4">
          {all.map(({ item, slot }) => {
            const how = state(item, SAMPLE.coins);
            return (
              <li
                key={item.id}
                style={{ background: tone.surface }}
                className={`flex flex-col gap-3 rounded-2xl p-5 ${FLAT_SKIN.body}`}
              >
                <span
                  style={{ color: tone.muted }}
                  className="text-[11px] tracking-[0.08em] uppercase"
                >
                  {copy.slot(slot)}
                </span>
                <span className="flex items-center gap-2 text-[16px] font-bold">
                  {item.swatch === undefined ? null : <Swatch item={item} tone={tone} />}
                  {copy.itemName(item.id)}
                </span>
                <span
                  style={{
                    background:
                      how === 'buy'
                        ? tone.accent
                        : how === 'worn'
                          ? tone.second
                          : tone.bg,
                    color: how === 'buy' || how === 'worn' ? tone.onAccent : tone.muted,
                  }}
                  className="mt-auto rounded-lg px-3 py-2 text-center text-[13px] font-semibold"
                >
                  {how === 'worn'
                    ? copy.worn
                    : how === 'owned'
                      ? copy.wear
                      : how === 'tooDear'
                        ? copy.tooDear
                        : `${copy.buy} · ${copy.price(item.price)}`}
                </span>
              </li>
            );
          })}
        </ul>
      </main>
    </Shell>
  );
}

/** S3 — what you wear first, the rest as a list underneath. */
export function ShopWorn({ copy, theme, onAdminPage }: ShopProps) {
  const tone = J2[theme];
  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="s3-menu">
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-8 sm:py-8">
        <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
          <div className="flex flex-col gap-4">
            <Balance copy={copy} tone={tone} />
            {/* What is on you now, which is the question a shop answers second
                and this arrangement answers first. */}
            <section style={{ background: tone.surface }} className="rounded-2xl p-5">
              <h2 className="m-0 text-[15px] font-bold">{copy.worn}</h2>
              <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
                {SHOP.map((slot) => {
                  const on = slot.items.find((item) => item.worn);
                  return (
                    <li
                      key={slot.id}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span style={{ color: tone.muted }} className="text-[12.5px]">
                        {copy.slot(slot.id)}
                      </span>
                      <span className="flex items-center gap-2 text-[13.5px] font-semibold">
                        {on?.swatch === undefined ? null : (
                          <Swatch item={on} tone={tone} />
                        )}
                        {on === undefined ? copy.tooDear : copy.itemName(on.id)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <div className="flex flex-col gap-3">
            {SHOP.map((slot) => (
              <section
                key={slot.id}
                style={{ background: tone.surface }}
                className="rounded-2xl p-4"
              >
                <h2 className="m-0 text-[13px] font-bold">{copy.slot(slot.id)}</h2>
                <ul className="m-0 mt-2 flex list-none flex-col p-0">
                  {slot.items.map((item) => {
                    const how = state(item, SAMPLE.coins);
                    return (
                      <li
                        key={item.id}
                        style={{ background: how === 'worn' ? tone.bg : 'transparent' }}
                        className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-[13.5px]"
                      >
                        {item.swatch === undefined ? null : (
                          <Swatch item={item} tone={tone} />
                        )}
                        <span className="min-w-0 flex-1 truncate">
                          {copy.itemName(item.id)}
                        </span>
                        <span
                          style={{
                            color:
                              how === 'worn'
                                ? tone.accent
                                : how === 'tooDear'
                                  ? tone.muted
                                  : tone.ink,
                          }}
                          className="text-[12.5px] font-semibold"
                        >
                          {how === 'worn'
                            ? copy.worn
                            : how === 'owned'
                              ? copy.wear
                              : how === 'tooDear'
                                ? copy.tooDear
                                : copy.price(item.price)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </main>
    </Shell>
  );
}
