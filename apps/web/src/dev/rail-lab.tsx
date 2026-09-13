'use client';

// The lab: one page at a time, in the panel it will live in.
//
// The rail is settled, and so are Overview, Players and Activation. Arrivals is
// the page under review, so it is the one with a switcher — and the period bar
// sits above all of them, because it always belonged to the panel rather than
// to a page.
import { useMemo, useState } from 'react';

import { ActivationFunnel } from './page-activation.js';
import {
  ARRIVALS_LAYOUTS,
  ArrivalsDigest,
  ArrivalsStep,
  ArrivalsTrend,
  type ArrivalsLayout,
} from './page-arrivals.js';
import { Digest } from './page-overview.js';
import { PlayersDigest } from './page-players.js';
import { PeriodBar } from './period-bar.js';
import { Rail } from './rail.js';
import { RailIcon } from './rail-icon.js';
import { allItems } from './rail-models.js';
import { DEFAULT_PERIOD, sampleFor, type Period } from './sample-data.js';

/** The narrow frame. 380px, because the repository measures screens at 360. */
const PHONE_WIDTH = 380;

/** The page the switcher is for. The others render what was chosen, or wait. */
const UNDER_REVIEW = 'traffic';

function chip(selected: boolean): string {
  return selected
    ? 'border-3 border-line-strong bg-accent px-3 py-2 text-[13px] font-bold text-on-fill shadow-sm'
    : 'border-3 border-line-strong bg-surface px-3 py-2 text-[13px] font-medium text-ink';
}

export function RailLab() {
  const [layout, setLayout] = useState<ArrivalsLayout>(
    ARRIVALS_LAYOUTS[0] as ArrivalsLayout,
  );
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [activeId, setActiveId] = useState(UNDER_REVIEW);
  const [narrow, setNarrow] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const data = useMemo(() => sampleFor(period), [period]);
  const active = allItems().find((item) => item.id === activeId) ?? allItems()[0];

  function select(id: string): void {
    setActiveId(id);
    setDrawerOpen(false);
  }

  return (
    <div className="flex min-h-dvh flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3">
        <h1 className="m-0 text-2xl font-extrabold text-ink">Arrivals lab</h1>
        <p className="m-0 max-w-prose text-sm text-muted">
          The rail, Overview, Players and Activation are settled — open them in the rail.
          Three arrangements of Arrivals, the most misreadable page here: two counts and a
          ratio, and not one of them is a number of people. They differ on how hard they
          work to stop that misreading. The period above the page moves every figure that
          has a date, and the values are sample data, not a database.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
          Arrivals
        </span>
        {ARRIVALS_LAYOUTS.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            aria-pressed={candidate.id === layout.id}
            onClick={() => {
              setLayout(candidate);
              setActiveId(UNDER_REVIEW);
            }}
            className={chip(candidate.id === layout.id)}
          >
            {candidate.name}
          </button>
        ))}

        <span className="ml-4 font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
          Width
        </span>
        <button
          type="button"
          aria-pressed={!narrow}
          onClick={() => {
            setNarrow(false);
            setDrawerOpen(false);
          }}
          className={chip(!narrow)}
        >
          Desktop
        </button>
        <button
          type="button"
          aria-pressed={narrow}
          onClick={() => {
            setNarrow(true);
          }}
          className={chip(narrow)}
        >
          Phone
        </button>
      </div>

      <dl className="m-0 grid gap-2 border-3 border-line-strong bg-surface p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
            The bet
          </dt>
          <dd className="m-0 text-sm text-ink-2">{layout.bet}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
            What it costs
          </dt>
          <dd className="m-0 text-sm text-ink-2">{layout.cost}</dd>
        </div>
      </dl>

      {/* The frame. A fixed narrow width rather than a media query, so that both
          widths can be looked at on one screen without resizing a browser. */}
      <div
        className="relative flex overflow-hidden border-3 border-line-strong bg-bg shadow-md"
        style={{
          height: 940,
          width: narrow ? PHONE_WIDTH : '100%',
          maxWidth: '100%',
        }}
      >
        {narrow ? null : (
          <div className="w-62 shrink-0">
            <Rail activeId={activeId} onSelect={select} />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="flex items-center gap-3 border-b-3 border-line-strong bg-surface px-5 py-4">
            {narrow ? (
              <button
                type="button"
                aria-expanded={drawerOpen}
                onClick={() => {
                  setDrawerOpen(!drawerOpen);
                }}
                className="flex size-11 shrink-0 items-center justify-center border-3 border-line-strong bg-accent text-on-fill shadow-sm"
              >
                <RailIcon name="grid" size={18} />
                <span className="sr-only">Sections</span>
              </button>
            ) : null}
            <span className="truncate text-xl font-extrabold text-ink">
              {active?.label}
            </span>
          </div>

          <PeriodBar period={period} onChoose={setPeriod} />

          <div className="flex-1 p-5">
            {activeId === 'overview' ? <Digest data={data} /> : null}
            {activeId === 'players' ? <PlayersDigest data={data} /> : null}
            {activeId === 'activation' ? <ActivationFunnel data={data} /> : null}
            {activeId === UNDER_REVIEW ? (
              <>
                {layout.id === 'digest' ? <ArrivalsDigest data={data} /> : null}
                {layout.id === 'step' ? <ArrivalsStep data={data} /> : null}
                {layout.id === 'trend' ? <ArrivalsTrend data={data} /> : null}
              </>
            ) : null}
            {['overview', 'players', 'activation', UNDER_REVIEW].includes(
              activeId,
            ) ? null : (
              <p className="m-0 pt-16 text-center text-sm text-muted">
                <span className="font-bold text-ink">{active?.label}</span> gets its own
                round of this. Overview, Players, Activation and Arrivals are drawn so
                far.
              </p>
            )}
          </div>
        </div>

        {narrow && drawerOpen ? (
          <>
            <button
              type="button"
              aria-label="Close the sections"
              onClick={() => {
                setDrawerOpen(false);
              }}
              className="absolute inset-0 border-0 bg-ink/60"
            />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85%]">
              <Rail activeId={activeId} onSelect={select} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
