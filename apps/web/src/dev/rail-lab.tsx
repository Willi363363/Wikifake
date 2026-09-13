'use client';

// The lab: every page of the panel, in the panel.
//
// Four pages are settled and render what was chosen — Overview, Players,
// Activation, Arrivals. Four are still open and carry their candidates:
// Rounds, Content, Cost, Health. Open one in the rail and its switcher appears
// above the frame; open a settled one and there is nothing to choose.
//
// The period bar sits above all of them, because it belongs to the panel
// rather than to a page — and it deliberately does not reach Health, which is
// three probes with no history to filter.
import { useMemo, useState, type ReactNode } from 'react';

import { ActivationFunnel } from './page-activation.js';
import { ArrivalsDigest } from './page-arrivals.js';
import {
  CONTENT_LAYOUTS,
  ContentDigest,
  ContentLibrary,
  ContentSplit,
} from './page-content.js';
import { COST_LAYOUTS, CostDigest, CostLedger, CostUnit } from './page-cost.js';
import {
  HEALTH_LAYOUTS,
  HealthBoard,
  HealthDeployment,
  HealthDigest,
} from './page-health.js';
import { Digest } from './page-overview.js';
import { PlayersDigest } from './page-players.js';
import { ROUNDS_LAYOUTS, RoundsDigest, RoundsModes, RoundsSeats } from './page-rounds.js';
import { PeriodBar } from './period-bar.js';
import { Rail } from './rail.js';
import { RailIcon } from './rail-icon.js';
import { allItems } from './rail-models.js';
import { DEFAULT_PERIOD, sampleFor, type Period, type Sample } from './sample-data.js';

/** The narrow frame. 380px, because the repository measures screens at 360. */
const PHONE_WIDTH = 380;

interface Candidate {
  readonly id: string;
  readonly name: string;
  readonly bet: string;
  readonly cost: string;
}

interface Open {
  readonly layouts: readonly Candidate[];
  readonly render: (id: string, data: Sample) => ReactNode;
}

/** The four pages still to decide, and what each one is choosing between. */
const OPEN: Readonly<Record<string, Open>> = {
  games: {
    layouts: ROUNDS_LAYOUTS,
    render: (id, data) => {
      if (id === 'digest') return <RoundsDigest data={data} />;
      if (id === 'modes') return <RoundsModes data={data} />;
      return <RoundsSeats data={data} />;
    },
  },
  content: {
    layouts: CONTENT_LAYOUTS,
    render: (id, data) => {
      if (id === 'digest') return <ContentDigest data={data} />;
      if (id === 'split') return <ContentSplit data={data} />;
      return <ContentLibrary data={data} />;
    },
  },
  cost: {
    layouts: COST_LAYOUTS,
    render: (id, data) => {
      if (id === 'digest') return <CostDigest data={data} />;
      if (id === 'unit') return <CostUnit data={data} />;
      return <CostLedger data={data} />;
    },
  },
  health: {
    layouts: HEALTH_LAYOUTS,
    render: (id, data) => {
      if (id === 'digest') return <HealthDigest data={data} />;
      if (id === 'board') return <HealthBoard data={data} />;
      return <HealthDeployment data={data} />;
    },
  },
};

/** The four already chosen. */
const SETTLED: Readonly<Record<string, (data: Sample) => ReactNode>> = {
  overview: (data) => <Digest data={data} />,
  players: (data) => <PlayersDigest data={data} />,
  activation: (data) => <ActivationFunnel data={data} />,
  traffic: (data) => <ArrivalsDigest data={data} />,
};

function chip(selected: boolean): string {
  return selected
    ? 'border-3 border-line-strong bg-accent px-3 py-2 text-[13px] font-bold text-on-fill shadow-sm'
    : 'border-3 border-line-strong bg-surface px-3 py-2 text-[13px] font-medium text-ink';
}

export function RailLab() {
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [activeId, setActiveId] = useState('games');
  /** One chosen candidate per open page, so switching pages keeps the choice. */
  const [chosen, setChosen] = useState<Readonly<Record<string, string>>>({});
  const [narrow, setNarrow] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const data = useMemo(() => sampleFor(period), [period]);
  const active = allItems().find((item) => item.id === activeId) ?? allItems()[0];

  const open = OPEN[activeId];
  const layoutId =
    open === undefined ? '' : (chosen[activeId] ?? (open.layouts[0] as Candidate).id);
  const layout = open?.layouts.find((one) => one.id === layoutId);

  function select(id: string): void {
    setActiveId(id);
    setDrawerOpen(false);
  }

  return (
    <div className="flex min-h-dvh flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3">
        <h1 className="m-0 text-2xl font-extrabold text-ink">Admin panel lab</h1>
        <p className="m-0 max-w-prose text-sm text-muted">
          Every page of the panel, in the panel. Overview, Players, Activation and
          Arrivals are settled and render what was chosen. Rounds, Content, Cost and
          Health each carry three candidates — pick a page in the rail and its switcher
          appears below. The period moves every figure that has a date; the values are
          sample data, not a database.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
          {active?.label}
        </span>
        {open === undefined ? (
          <span className="border-3 border-line bg-bg px-3 py-2 text-[13px] text-muted">
            Settled — nothing to choose here
          </span>
        ) : (
          open.layouts.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              aria-pressed={candidate.id === layoutId}
              onClick={() => {
                setChosen({ ...chosen, [activeId]: candidate.id });
              }}
              className={chip(candidate.id === layoutId)}
            >
              {candidate.name}
            </button>
          ))
        )}

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

      {layout === undefined ? null : (
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
      )}

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
            {SETTLED[activeId]?.(data)}
            {open?.render(layoutId, data)}
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
