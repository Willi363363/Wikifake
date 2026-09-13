'use client';

// The lab: one page at a time, in the rail it will live in.
//
// The rail is settled and so is Overview. Players is the page under review, so
// it is the one with a switcher; every page already decided renders what was
// chosen, and the ones still waiting say so.
import { useState } from 'react';

import { Digest } from './page-overview.js';
import {
  PLAYERS_LAYOUTS,
  PlayersDigest,
  PlayersHalves,
  PlayersRoster,
  type PlayersLayout,
} from './page-players.js';
import { Rail } from './rail.js';
import { RailIcon } from './rail-icon.js';
import { allItems } from './rail-models.js';
import { SAMPLE } from './sample-data.js';

/** The narrow frame. 380px, because the repository measures screens at 360. */
const PHONE_WIDTH = 380;

/** The page the switcher is for. The others render or wait. */
const UNDER_REVIEW = 'players';

function chip(selected: boolean): string {
  return selected
    ? 'border-3 border-line-strong bg-accent px-3 py-2 text-[13px] font-bold text-on-fill shadow-sm'
    : 'border-3 border-line-strong bg-surface px-3 py-2 text-[13px] font-medium text-ink';
}

export function RailLab() {
  const [layout, setLayout] = useState<PlayersLayout>(
    PLAYERS_LAYOUTS[0] as PlayersLayout,
  );
  const [activeId, setActiveId] = useState(UNDER_REVIEW);
  const [narrow, setNarrow] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const active = allItems().find((item) => item.id === activeId) ?? allItems()[0];
  const onPlayers = activeId === UNDER_REVIEW;

  function select(id: string): void {
    setActiveId(id);
    setDrawerOpen(false);
  }

  return (
    <div className="flex min-h-dvh flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3">
        <h1 className="m-0 text-2xl font-extrabold text-ink">Players lab</h1>
        <p className="m-0 max-w-prose text-sm text-muted">
          The rail is settled, and so is Overview — open it in the rail to see it. Three
          arrangements of the Players page, drawn from the same figures, so what is being
          compared is which of its two questions it treats as the page. Every figure
          exists in a reader today; the values are sample data, not a database.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
          Players
        </span>
        {PLAYERS_LAYOUTS.map((candidate) => (
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
          height: 900,
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
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-xl font-extrabold text-ink">
                {active?.label}
              </span>
              <span className="truncate font-mono text-[11px] text-muted">
                {SAMPLE.range.label}
              </span>
            </div>
          </div>

          <div className="flex-1 p-5">
            {activeId === 'overview' ? <Digest /> : null}
            {onPlayers ? (
              <>
                {layout.id === 'digest' ? <PlayersDigest /> : null}
                {layout.id === 'halves' ? <PlayersHalves /> : null}
                {layout.id === 'roster' ? <PlayersRoster /> : null}
              </>
            ) : null}
            {activeId === 'overview' || onPlayers ? null : (
              <p className="m-0 pt-16 text-center text-sm text-muted">
                <span className="font-bold text-ink">{active?.label}</span> gets its own
                round of this. Overview and Players are drawn so far.
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
