'use client';

// The lab: three navigations, one page, switchable.
//
// It exists to answer three questions and no others — how many pages there
// are, what they are called, and how the rail behaves when you use it. So the
// body of each page is a stub that says what would go there rather than a
// second mockup nobody asked for yet.
import { useState } from 'react';

import { Rail } from './rail.js';
import { RailIcon } from './rail-icon.js';
import { itemsOf, MODELS, type Model } from './rail-models.js';

/** The narrow frame. 380px, because the repository measures screens at 360. */
const PHONE_WIDTH = 380;

function chip(selected: boolean): string {
  return selected
    ? 'border-3 border-line-strong bg-accent px-3 py-2 text-[13px] font-bold text-on-fill shadow-sm'
    : 'border-3 border-line-strong bg-surface px-3 py-2 text-[13px] font-medium text-ink';
}

export function RailLab() {
  const [model, setModel] = useState<Model>(MODELS[0] as Model);
  const [activeId, setActiveId] = useState('overview');
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const [narrow, setNarrow] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState(0);

  const active = itemsOf(model).find((item) => item.id === activeId) ?? itemsOf(model)[0];

  function chooseModel(next: Model): void {
    setModel(next);
    // Every model has an Overview, and it is the only id all three share.
    setActiveId('overview');
    setFolded(new Set());
    setTab(0);
  }

  function select(id: string): void {
    setActiveId(id);
    setTab(0);
    setDrawerOpen(false);
  }

  function toggleGroup(id: string): void {
    const next = new Set(folded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFolded(next);
  }

  return (
    <div className="flex min-h-dvh flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3">
        <h1 className="m-0 text-2xl font-extrabold text-ink">Rail lab</h1>
        <p className="m-0 max-w-prose text-sm text-muted">
          Three navigations for the admin panel, side by side in the real stack. Only the
          shape of the rail is being decided here — how many pages, what they are called,
          how it behaves under a cursor. What each page holds comes later.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
          Model
        </span>
        {MODELS.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            aria-pressed={candidate.id === model.id}
            onClick={() => {
              chooseModel(candidate);
            }}
            className={chip(candidate.id === model.id)}
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
          <dd className="m-0 text-sm text-ink-2">{model.bet}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
            What it costs
          </dt>
          <dd className="m-0 text-sm text-ink-2">{model.cost}</dd>
        </div>
      </dl>

      {/* The frame. A fixed narrow width rather than a media query, so that both
          widths can be looked at on one screen without resizing a browser. */}
      <div
        className="relative flex overflow-hidden border-3 border-line-strong bg-bg shadow-md"
        style={{
          // Tall enough that model B's eight entries and three headings fit
          // without scrolling: a rail that scrolls in one model and not in the
          // others is not being compared on its shape any more.
          height: 740,
          width: narrow ? PHONE_WIDTH : '100%',
          maxWidth: '100%',
        }}
      >
        {narrow ? null : (
          <div className="w-62 shrink-0">
            <Rail
              model={model}
              activeId={active?.id ?? 'overview'}
              onSelect={select}
              folded={folded}
              onToggleGroup={toggleGroup}
            />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 border-b-3 border-line-strong bg-surface px-4 py-3">
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
                {active?.route}
              </span>
            </div>
          </div>

          {active?.tabs === undefined ? null : (
            <div className="flex gap-2 overflow-x-auto border-b-3 border-line-strong bg-surface px-4 py-2.5">
              {active.tabs.map((name, at) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={at === tab}
                  onClick={() => {
                    setTab(at);
                  }}
                  className={`min-h-11 whitespace-nowrap ${chip(at === tab)}`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-1 items-center justify-center p-6">
            <p className="m-0 max-w-prose text-center text-sm text-muted">
              The body of{' '}
              <span className="font-bold text-ink">
                {active?.tabs === undefined ? active?.label : active.tabs[tab]}
              </span>{' '}
              is not part of this decision. Only the rail is.
            </p>
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
              <Rail
                model={model}
                activeId={active?.id ?? 'overview'}
                onSelect={select}
                folded={folded}
                onToggleGroup={toggleGroup}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
