'use client';

// The admin panel, three arrangements — step L.1, round ten.
//
// **The question this page asks is not about colour.** Track K gave the panel a
// rail down the left and eight routes; the owner now wants a bar across the top
// on every screen. Two navigations on one screen is a decision, not a detail,
// and these three take it three different ways.
//
// The figures are track K's own, unchanged: the panel reads, it never writes,
// and nothing here invents a measurement. What moves is where a reader stands.
//
// **The way back is on all three**, because it is half the owner's request. A
// panel you can enter and not leave is a panel people close with the tab.
import { Shell } from './shell.js';
import type { Copy } from './copy.js';
import { ADMIN } from './sample.js';
import { J2 } from './variants.js';
import type { Theme, Tone } from './tone.js';

export interface AdminProps {
  readonly copy: Copy;
  readonly theme: Theme;
  /** The lab's own switch, so the way back can be seen from here. */
  readonly onAdminPage: boolean;
}

function Tile({
  label,
  value,
  note,
  tone,
  filled = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
  readonly tone: Tone;
  readonly filled?: boolean;
}) {
  return (
    <div
      style={
        filled
          ? { background: tone.accent, color: tone.onAccent }
          : { background: tone.surface }
      }
      className="rounded-2xl p-5"
    >
      <span
        style={{ color: filled ? tone.onAccent : tone.muted }}
        className="text-[12px]"
      >
        {label}
      </span>
      <p className="m-0 mt-1.5 text-[30px] leading-none font-bold tabular-nums">
        {value}
      </p>
      {note === undefined ? null : (
        <p
          style={{ color: filled ? tone.onAccent : tone.muted }}
          className="m-0 mt-1.5 text-[12px]"
        >
          {note}
        </p>
      )}
    </div>
  );
}

function Figures({ copy, tone }: { readonly copy: Copy; readonly tone: Tone }) {
  const share = `${String(Math.round(ADMIN.soloShare * 100))}%`;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile tone={tone} label={copy.adminAccounts} value={String(ADMIN.accounts)} />
      <Tile
        tone={tone}
        label={copy.adminActiveToday}
        value={String(ADMIN.activeToday)}
        note={`${String(ADMIN.activeThisWeek)} / 7 j`}
      />
      <Tile
        tone={tone}
        label={copy.adminRounds}
        value={String(ADMIN.rounds)}
        note={`${share} solo`}
      />
      <Tile
        tone={tone}
        filled
        label={copy.adminSpend}
        value={String(ADMIN.spend)}
        note={String(ADMIN.perRound)}
      />
    </div>
  );
}

function Funnel({ copy, tone }: { readonly copy: Copy; readonly tone: Tone }) {
  const top = ADMIN.funnel[0]?.count ?? 1;
  return (
    <section style={{ background: tone.surface }} className="rounded-2xl p-5">
      <h2 className="m-0 mb-3 text-[15px] font-bold">{copy.adminActivation}</h2>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {ADMIN.funnel.map((step) => (
          <li key={step.step} className="flex items-center gap-3">
            <span
              style={{
                background: tone.accent,
                color: tone.onAccent,
                width: `${String(Math.max(30, (step.count / top) * 100))}%`,
              }}
              className="flex h-8 items-center rounded-lg px-3 text-[13px] font-semibold"
            >
              <span className="truncate">{copy.adminStep(step.step)}</span>
            </span>
            <span className="text-[14px] font-bold tabular-nums">{step.count}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Health({ copy, tone }: { readonly copy: Copy; readonly tone: Tone }) {
  return (
    <section
      style={{ background: tone.surface }}
      className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl p-5"
    >
      {ADMIN.services.map((service) => (
        <span key={service.name} className="flex items-center gap-2">
          <span
            style={{ background: service.up ? '#16A34A' : '#DC2626' }}
            className="size-2.5 rounded-full"
          />
          <span className="text-[13px]">{copy.adminService(service.name)}</span>
          {service.ms > 0 ? (
            <span style={{ color: tone.muted }} className="text-[11.5px] tabular-nums">
              {service.ms} ms
            </span>
          ) : null}
        </span>
      ))}
      <span style={{ color: tone.muted }} className="text-[11.5px]">
        {copy.adminSameCommit}
      </span>
    </section>
  );
}

/** A1 — the rail stays, under the site bar. Two navigations, nested. */
export function AdminRail({ copy, theme, onAdminPage }: AdminProps) {
  const tone = J2[theme];
  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="a1-menu">
      <main className="mx-auto flex max-w-6xl gap-4 px-4 py-5 sm:px-8 sm:py-8">
        <nav
          aria-label={copy.adminTitle}
          style={{ background: tone.surface }}
          className="hidden w-52 shrink-0 flex-col gap-0.5 rounded-2xl p-3 lg:flex"
        >
          {ADMIN.sections.map((section, at) => (
            <a
              key={section.route}
              href="#"
              style={
                at === 0
                  ? { background: tone.accent, color: tone.onAccent }
                  : { color: tone.muted }
              }
              className="rounded-lg px-3 py-2.5 text-[13.5px] font-medium"
            >
              {copy.adminSection(section.key)}
            </a>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Figures copy={copy} tone={tone} />
          <Funnel copy={copy} tone={tone} />
          <Health copy={copy} tone={tone} />
        </div>
      </main>
    </Shell>
  );
}

/** A2 — no rail. The sections become a row of tabs under the site bar. */
export function AdminTabs({ copy, theme, onAdminPage }: AdminProps) {
  const tone = J2[theme];
  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="a2-menu">
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-8 sm:py-8">
        {/* One navigation on the screen, and it scrolls sideways rather than
            collapsing: seven names do not fit a phone, and a menu inside a menu
            is how somebody loses their place. */}
        <nav
          aria-label={copy.adminTitle}
          className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1"
        >
          {ADMIN.sections.map((section, at) => (
            <a
              key={section.route}
              href="#"
              style={
                at === 0
                  ? { background: tone.accent, color: tone.onAccent }
                  : { background: tone.surface, color: tone.muted }
              }
              className="shrink-0 rounded-full px-4 py-2 text-[13.5px] font-medium whitespace-nowrap"
            >
              {copy.adminSection(section.key)}
            </a>
          ))}
        </nav>

        <Figures copy={copy} tone={tone} />
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Funnel copy={copy} tone={tone} />
          <Health copy={copy} tone={tone} />
        </div>
      </main>
    </Shell>
  );
}

/** A3 — no permanent section nav at all: the overview is the way in. */
export function AdminOverview({ copy, theme, onAdminPage }: AdminProps) {
  const tone = J2[theme];
  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="a3-menu">
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-8 sm:py-8">
        <Figures copy={copy} tone={tone} />
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Funnel copy={copy} tone={tone} />
          <Health copy={copy} tone={tone} />
        </div>

        {/* The sections as destinations rather than as a rail. The panel is
            opened to answer a question, and the question decides the page. */}
        <nav
          aria-label={copy.adminTitle}
          className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {ADMIN.sections.map((section) => (
            <a
              key={section.route}
              href="#"
              style={{ background: tone.surface }}
              className="rounded-2xl px-4 py-4 text-[14px] font-semibold"
            >
              {copy.adminSection(section.key)} →
            </a>
          ))}
        </nav>
      </main>
    </Shell>
  );
}
