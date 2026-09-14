'use client';

// The admin panel, repainted and not redesigned — step L.1, round ten.
//
// **There is nothing to choose here, so there is one mockup.** The owner built
// this panel page by page a few hours ago — the rail in boxed groups, the eight
// routes, the period bar, the digest — and asked for exactly one thing from
// track L: the colours.
//
// So this is track K's own structure, wearing J2. The rail keeps its three
// boxed groups with Overview outside them, the period bar keeps its five
// calendar presets and the custom one, the digest keeps its four figures, its
// funnel and its line of health. Not a control moved.
//
// **That constraint has a useful consequence.** If nothing but the palette
// changes, `players-screen.test.tsx` and its seven siblings keep passing
// untouched — and a green suite is then the proof that no UX changed, rather
// than a claim somebody has to be believed about.
import { Shell } from './shell.js';
import type { Copy } from './copy.js';
import { ADMIN } from './sample.js';
import { J2 } from './variants.js';
import type { Theme, Tone } from './tone.js';

export interface AdminProps {
  readonly copy: Copy;
  readonly theme: Theme;
  readonly onAdminPage: boolean;
}

/** Track K's grouping, unchanged: Overview alone, then three boxed groups. */
const GROUPS = [
  { key: 'audience', sections: [0, 1, 2] },
  { key: 'game', sections: [3, 4] },
  { key: 'system', sections: [5, 6] },
];

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

export function AdminRepainted({ copy, theme, onAdminPage }: AdminProps) {
  const tone = J2[theme];
  const top = ADMIN.funnel[0]?.count ?? 1;
  const share = `${String(Math.round(ADMIN.soloShare * 100))}%`;

  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="admin-menu">
      <div className="flex">
        {/* K.1's rail: boxed groups, Overview outside all three. */}
        <nav
          aria-label={copy.adminTitle}
          className="hidden w-60 shrink-0 flex-col gap-3 p-4 lg:flex"
        >
          <a
            href="#"
            style={{ background: tone.accent, color: tone.onAccent }}
            className="rounded-xl px-3 py-2.5 text-[13.5px] font-semibold"
          >
            {copy.adminOverview}
          </a>

          {GROUPS.map((group) => (
            <div
              key={group.key}
              style={{ background: tone.surface }}
              className="rounded-2xl p-2"
            >
              <span
                style={{ color: tone.muted }}
                className="block px-2 py-1.5 text-[10.5px] tracking-[0.12em] uppercase"
              >
                {copy.adminGroups.find((one) => one.key === group.key)?.label}
              </span>
              {group.sections.map((at) => (
                <a
                  key={ADMIN.sections[at]?.route}
                  href="#"
                  style={{ color: tone.muted }}
                  className="block rounded-lg px-2 py-2 text-[13.5px]"
                >
                  {copy.adminSection(ADMIN.sections[at]?.key ?? '')}
                </a>
              ))}
            </div>
          ))}

          <span
            style={{ color: tone.muted }}
            className="mt-auto px-2 text-[10.5px] tracking-[0.1em] uppercase"
          >
            {copy.adminReadOnly}
          </span>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* K.2's period bar: five calendar presets, and the custom one. */}
          <div
            style={{ background: tone.surface }}
            className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-6"
          >
            <span
              style={{ color: tone.muted }}
              className="text-[10.5px] tracking-[0.12em] uppercase"
            >
              {copy.adminPeriod}
            </span>
            {copy.adminPresets.map((preset, at) => (
              <a
                key={preset.id}
                href="#"
                style={
                  at === 2
                    ? { background: tone.accent, color: tone.onAccent }
                    : { background: tone.bg, color: tone.muted }
                }
                className="rounded-full px-3 py-1.5 text-[13px] whitespace-nowrap"
              >
                {preset.label}
              </a>
            ))}
          </div>

          <main className="flex flex-col gap-4 p-4 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Tile
                tone={tone}
                label={copy.adminAccounts}
                value={String(ADMIN.accounts)}
              />
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
                    <span className="text-[14px] font-bold tabular-nums">
                      {step.count}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

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
                    <span
                      style={{ color: tone.muted }}
                      className="text-[11.5px] tabular-nums"
                    >
                      {service.ms} ms
                    </span>
                  ) : null}
                </span>
              ))}
              <span style={{ color: tone.muted }} className="text-[11.5px]">
                {copy.adminSameCommit}
              </span>
            </section>
          </main>
        </div>
      </div>
    </Shell>
  );
}
