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

import { CandidateBento } from './candidate-bento.js';
import { CandidateConsole } from './candidate-console.js';
import { CandidateFeed } from './candidate-feed.js';
import { useCopy } from './copy.js';
import type { Theme } from './tone.js';

type Which = 'bento' | 'feed' | 'console';

interface Option {
  readonly id: Which;
  readonly name: string;
  readonly nav: string;
  readonly bet: string;
  readonly risk: string;
}

/** The bench's own chrome is English: it is not the product. */
const OPTIONS: readonly Option[] = [
  {
    id: 'bento',
    name: 'J — tiles of unequal size',
    nav: 'play is the biggest tile',
    bet: 'Play earns the eye by area and position rather than by glowing, and it sits among the things that make somebody open the site again.',
    risk: 'Unequal tiles are a fashion of the last two years, and fashions date.',
  },
  {
    id: 'feed',
    name: 'K — a column, and a sidebar',
    nav: 'play is the first row',
    bet: 'The oldest arrangement on the web and still the most used. A returning player does not need persuading, they need the fastest line to the next round.',
    risk: 'It looks like software, and a first visitor sees numbers instead of a reason to start.',
  },
  {
    id: 'console',
    name: 'L — tabular, dense',
    nav: 'play is a bar, everything else a row',
    bet: 'The register of things people keep open for years. No card has a shadow because no card exists: the page is a table.',
    risk: 'Density is a taste, and it is not most peoples. Look at it on the phone first.',
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
  const [which, setWhich] = useState<Which>('bento');
  const [theme, setTheme] = useState<Theme>('dark');
  const [isAdmin, setIsAdmin] = useState(false);
  const [onAdminPage, setOnAdminPage] = useState(false);
  const [phone, setPhone] = useState(false);
  const copy = useCopy(isAdmin);

  const chosen = OPTIONS.find((one) => one.id === which) as Option;
  const body =
    which === 'bento' ? (
      <CandidateBento copy={copy} theme={theme} onAdminPage={onAdminPage} />
    ) : which === 'feed' ? (
      <CandidateFeed copy={copy} theme={theme} onAdminPage={onAdminPage} />
    ) : (
      <CandidateConsole copy={copy} theme={theme} onAdminPage={onAdminPage} />
    );

  return (
    <div className="min-h-dvh bg-neutral-100 text-neutral-900">
      <div className="border-b border-neutral-300 bg-neutral-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {OPTIONS.map((one) => (
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
