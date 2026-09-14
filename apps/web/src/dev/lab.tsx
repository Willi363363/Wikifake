'use client';

// The bench the three candidates sit on — step L.1.
//
// Three directions, one page, switchable, on the real catalogue. Plus the two
// switches the owner's request turns on:
//
//   - **admin or not**, because the new entry must appear for one kind of
//     account and be *absent* — not hidden — for every other;
//   - **on the admin page or not**, because the way back is half the request
//     and a mockup that only draws the way in answers half of it.
//
// **The phone frame is a preview, not the test.** It is 390 pixels wide and
// honest about layout, but a real phone is the only thing that says whether a
// tap target is reachable — `13-ui-overhaul.md` carries how to serve this over
// a LAN, because `next dev` does not hydrate there.
//
// This whole directory dies at L.8, with the decision it exists to inform.
import { useState } from 'react';

import { ShopGrid, ShopRows, ShopWorn } from './shop-variants.js';
import { VariantDense, VariantFlat, VariantQuiet } from './variants.js';
import { useCopy } from './copy.js';
import type { Theme } from './tone.js';

type Page = 'home' | 'shop';
type Which = 'quiet' | 'flat' | 'dense' | 'rows' | 'grid' | 'worn';

interface Option {
  readonly page: Page;
  readonly id: Which;
  readonly name: string;
  readonly nav: string;
  readonly bet: string;
  readonly risk: string;
}

/** The bench's own chrome is English: it is not the product. */
const OPTIONS: readonly Option[] = [
  {
    page: 'home',
    id: 'quiet',
    name: 'J1 — hairlines, deep green',
    nav: 'the one you saw',
    bet: 'Every tile is a card with a thin edge. Only Play carries colour, so the eye has exactly one place to land.',
    risk: 'Quiet enough to be forgettable, which is the complaint that started this track.',
  },
  {
    page: 'home',
    id: 'flat',
    name: 'J2 — chosen',
    nav: 'the tiles are the structure',
    bet: 'No hairline anywhere: a tile is separated by being a different surface. Bigger numbers, more air.',
    risk: 'Without edges the grid can read as soft.',
  },
  {
    page: 'home',
    id: 'dense',
    name: 'J3 — tight radius, warm ink, red',
    nav: 'more on one screen',
    bet: 'Small radius, small type, tiles on the page rather than raised above it.',
    risk: 'The red competes with the colour a wrong answer will need.',
  },
  {
    page: 'shop',
    id: 'rows',
    name: 'S1 — a row per slot',
    nav: 'the shape the dashboard implies',
    bet: 'One section per slot, items side by side. A player shopping for a marker never reads the frames.',
    risk: 'Three sections of four is a lot of scrolling on a phone for ten objects.',
  },
  {
    page: 'shop',
    id: 'grid',
    name: 'S2 — one grid, slot as a label',
    nav: 'everything comparable at once',
    bet: 'Ten cards, one rhythm, the price on every one. You see what your coins reach without choosing a slot first.',
    risk: 'It flattens three kinds of thing that are not comparable — a colour is not a border.',
  },
  {
    page: 'shop',
    id: 'worn',
    name: 'S3 — what you wear, first',
    nav: 'the wardrobe before the till',
    bet: 'A shop you return to answers "what am I wearing" before "what can I buy". That panel leads, the catalogue follows as lists.',
    risk: 'It buries the prices, which is what brings somebody back to spend.',
  },
];

const TAB = 'rounded-md px-3 py-1.5 text-[13px] transition-colors';
const ON = `${TAB} bg-neutral-900 font-medium text-neutral-50`;
const OFF = `${TAB} text-neutral-600 hover:bg-neutral-200`;

function Switch({
  label,
  on,
  onToggle,
}: {
  readonly label: string;
  readonly on: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={`rounded-md border px-3 py-1.5 text-[13px] ${
        on
          ? 'border-neutral-900 bg-neutral-900 text-neutral-50'
          : 'border-neutral-300 text-neutral-600'
      }`}
    >
      {label}
    </button>
  );
}

export function Lab() {
  const [page, setPage] = useState<Page>('home');
  const [which, setWhich] = useState<Which>('flat');
  const [theme, setTheme] = useState<Theme>('dark');
  const [signedIn, setSignedIn] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [onAdminPage, setOnAdminPage] = useState(false);
  const [phone, setPhone] = useState(false);
  const copy = useCopy(isAdmin);

  const chosen = OPTIONS.find((one) => one.id === which) as Option;
  const body =
    which === 'quiet' ? (
      <VariantQuiet
        copy={copy}
        theme={theme}
        signedIn={signedIn}
        onAdminPage={onAdminPage}
      />
    ) : which === 'flat' ? (
      <VariantFlat
        copy={copy}
        theme={theme}
        signedIn={signedIn}
        onAdminPage={onAdminPage}
      />
    ) : which === 'dense' ? (
      <VariantDense
        copy={copy}
        theme={theme}
        signedIn={signedIn}
        onAdminPage={onAdminPage}
      />
    ) : which === 'rows' ? (
      <ShopRows copy={copy} theme={theme} onAdminPage={onAdminPage} />
    ) : which === 'grid' ? (
      <ShopGrid copy={copy} theme={theme} onAdminPage={onAdminPage} />
    ) : (
      <ShopWorn copy={copy} theme={theme} onAdminPage={onAdminPage} />
    );

  return (
    <div className="min-h-dvh bg-neutral-100 text-neutral-900">
      <div className="border-b border-neutral-300 bg-neutral-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Which page is being drawn. The direction is settled, so the
              bench moves on to the screens one at a time. */}
          {(['home', 'shop'] as const).map((one) => (
            <button
              key={one}
              type="button"
              onClick={() => {
                setPage(one);
                setWhich(one === 'home' ? 'flat' : 'rows');
              }}
              className={`${one === page ? ON : OFF} mr-1`}
            >
              {one}
            </button>
          ))}
          {OPTIONS.filter((one) => one.page === page).map((one) => (
            <button
              key={one.id}
              type="button"
              onClick={() => {
                setWhich(one.id);
              }}
              className={one.id === which ? ON : OFF}
            >
              {one.name}
            </button>
          ))}

          <span className="ml-auto flex flex-wrap items-center gap-2">
            {/* The theme is a switch and not a preference: the owner asked for
                both modes, so both are part of the candidate rather than a
                setting somebody remembers to check. */}
            <Switch
              label={theme === 'dark' ? 'dark' : 'light'}
              on={theme === 'dark'}
              onToggle={() => {
                setTheme(theme === 'dark' ? 'light' : 'dark');
              }}
            />
            <Switch
              label="phone"
              on={phone}
              onToggle={() => {
                setPhone(!phone);
              }}
            />
            {/* The two audiences a dashboard has to answer. A returning
                player arrives with a streak and a ranking; somebody who has
                just landed has neither, and a page that shows them zeroes is
                a page that says the game is empty. */}
            <Switch
              label={signedIn ? 'has an account' : 'first visit'}
              on={signedIn}
              onToggle={() => {
                setSignedIn(!signedIn);
              }}
            />
            <Switch
              label="signed in as admin"
              on={isAdmin}
              onToggle={() => {
                setIsAdmin(!isAdmin);
              }}
            />
            <Switch
              label="on /admin"
              on={onAdminPage}
              onToggle={() => {
                setOnAdminPage(!onAdminPage);
              }}
            />
          </span>
        </div>

        <p className="m-0 mt-2 max-w-4xl text-[12.5px] leading-relaxed text-neutral-600">
          <strong>{chosen.nav}.</strong> {chosen.bet}{' '}
          <span className="text-neutral-500">Risk: {chosen.risk}</span>
        </p>
      </div>

      {phone ? (
        <div className="flex justify-center py-8">
          <div className="w-[390px] overflow-hidden rounded-[2rem] border-8 border-neutral-900 shadow-2xl">
            <div className="h-[780px] overflow-y-auto">{body}</div>
          </div>
        </div>
      ) : (
        <div className="min-h-[calc(100dvh-5.5rem)]">{body}</div>
      )}
    </div>
  );
}
