'use client';

// Candidate L — tabular, and as dense as it can be read. Step L.1, round four.
//
// The register of things people keep open for years: a mail client, a trading
// screen, a fantasy-league table. Small type, tabular figures, rules instead of
// cards, and information per square centimetre rather than per screen.
//
// **Play is a bar across the top, and everything else is a row.** No card has a
// shadow because no card exists: the page is a table with a header, which is
// the least decorated thing on this list and the hardest to mistake for a
// template.
//
// The risk: density is a taste, and it is not most people's. On a phone it has
// to loosen, and the loosening is where this arrangement usually falls apart —
// which is exactly why the phone frame is the first place to look.
import { Shell } from './shell.js';
import type { Copy } from './copy.js';
import { SAMPLE } from './sample.js';
import type { Palette, Theme } from './tone.js';

const FACE = '"Segoe UI", system-ui, -apple-system, Arial, sans-serif';

export const CONSOLE: Palette = {
  light: {
    bg: '#FFFFFF',
    surface: '#F6F6F4',
    line: '#D8D8D4',
    ink: '#101010',
    muted: '#6C6C68',
    accent: '#1A4FD6',
    onAccent: '#FFFFFF',
    second: '#9A6400',
    font: FACE,
  },
  dark: {
    bg: '#0B0B0C',
    surface: '#141416',
    line: '#28282C',
    ink: '#E8E8E6',
    muted: '#8C8C88',
    accent: '#4C7EFF',
    onAccent: '#05070F',
    second: '#E0A64A',
    font: FACE,
  },
};

export interface CandidateProps {
  readonly copy: Copy;
  readonly theme: Theme;
  /** A returning player, or somebody who has just landed. */
  readonly signedIn: boolean;
  readonly onAdminPage: boolean;
}

const HEAD =
  'px-3 py-1.5 text-left text-[10.5px] font-semibold tracking-[0.1em] uppercase';
const CELL = 'px-3 py-2 text-[13px]';

export function CandidateConsole({ copy, theme, signedIn, onAdminPage }: CandidateProps) {
  const tone = CONSOLE[theme];
  const top = Math.max(...SAMPLE.week, 1);

  if (!signedIn) {
    return (
      <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="l-menu">
        <main className="mx-auto max-w-6xl px-3 py-4 sm:px-6">
          <a
            href="#"
            style={{ background: tone.accent, color: tone.onAccent }}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <span className="text-[16px] font-bold tracking-[0.02em] uppercase">
              {copy.play}
            </span>
            <span className="text-[12.5px] opacity-90">{copy.guest}</span>
          </a>

          <p className="mt-4 mb-0 max-w-2xl text-[14px] leading-[1.7]">
            {copy.description}
          </p>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            {/* The explanation as rows, because this arrangement has no cards
                to put it in. */}
            <table className="w-full border-collapse">
              <tbody>
                {copy.beats.map((beat, at) => (
                  <tr
                    key={beat.title}
                    style={{ borderColor: tone.line }}
                    className="border-b"
                  >
                    <td
                      style={{ color: tone.muted }}
                      className="px-3 py-2 align-top text-[13px] tabular-nums"
                    >
                      {at + 1}
                    </td>
                    <td className="px-3 py-2">
                      <span className="block text-[13px] font-semibold">
                        {beat.title}
                      </span>
                      <span
                        style={{ color: tone.muted }}
                        className="mt-0.5 block text-[12.5px] leading-[1.6]"
                      >
                        {beat.body}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <section>
              <table className="w-full border-collapse">
                <thead>
                  <tr
                    style={{ borderColor: tone.line, color: tone.muted }}
                    className="border-b"
                  >
                    <th scope="col" className={HEAD}>
                      {copy.board}
                    </th>
                    <th scope="col" className={`${HEAD} text-right`}>
                      ·
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE.board
                    .filter((row) => row.you !== true)
                    .map((row) => (
                      <tr
                        key={row.name}
                        style={{ borderColor: tone.line }}
                        className="border-b"
                      >
                        <td className={CELL}>
                          <span
                            style={{ color: tone.muted }}
                            className="mr-2 tabular-nums"
                          >
                            {row.place}
                          </span>
                          {row.name}
                        </td>
                        <td
                          style={{ color: tone.muted }}
                          className={`${CELL} text-right tabular-nums`}
                        >
                          {row.rounds}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>

              <div
                style={{ borderColor: tone.line }}
                className="mt-4 border-t pt-3 text-[12.5px] leading-[1.6]"
              >
                <span className="block font-semibold">{copy.keepTitle}</span>
                <span style={{ color: tone.muted }} className="mt-1 block">
                  {copy.keepLead}
                </span>
                <a
                  href="#"
                  style={{ color: tone.accent }}
                  className="mt-1.5 inline-block font-semibold"
                >
                  {copy.keepCta} →
                </a>
              </div>
            </section>
          </div>
        </main>
      </Shell>
    );
  }

  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="l-menu">
      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-6">
        <a
          href="#"
          style={{ background: tone.accent, color: tone.onAccent }}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        >
          <span className="text-[16px] font-bold tracking-[0.02em] uppercase">
            {copy.play}
          </span>
          <span className="text-[12.5px] tabular-nums opacity-90">
            {copy.streak} {SAMPLE.streak} · {copy.average} {SAMPLE.averageScore}% ·{' '}
            {copy.best} {SAMPLE.bestScore}% · {copy.coins(SAMPLE.coins)}
          </span>
        </a>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <section>
            <table className="w-full border-collapse">
              <thead>
                <tr
                  style={{ borderColor: tone.line, color: tone.muted }}
                  className="border-b"
                >
                  <th scope="col" className={HEAD}>
                    {copy.finished}
                  </th>
                  <th scope="col" className={`${HEAD} text-right`}>
                    %
                  </th>
                  <th scope="col" className={`${HEAD} text-right`}>
                    ·
                  </th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE.rounds.map((round) => (
                  <tr
                    key={round.topic}
                    style={{ borderColor: tone.line }}
                    className="border-b"
                  >
                    <td className={CELL}>{round.topic}</td>
                    <td className={`${CELL} text-right font-semibold tabular-nums`}>
                      {round.score}
                    </td>
                    <td
                      style={{ color: tone.muted }}
                      className={`${CELL} text-right tabular-nums`}
                    >
                      {round.when}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Seven days, as bars of a table rather than a chart. */}
            <div className="mt-4 flex items-end gap-1" style={{ height: '3.5rem' }}>
              {SAMPLE.week.map((day, at) => (
                <span
                  key={`${String(at)}-${String(day)}`}
                  title={String(day)}
                  style={{
                    background: day === 0 ? tone.line : tone.accent,
                    height: `max(3px, ${String((day / top) * 100)}%)`,
                  }}
                  className="min-w-0 flex-1"
                />
              ))}
            </div>
          </section>

          <section>
            <table className="w-full border-collapse">
              <thead>
                <tr
                  style={{ borderColor: tone.line, color: tone.muted }}
                  className="border-b"
                >
                  <th scope="col" className={HEAD}>
                    {copy.board}
                  </th>
                  <th scope="col" className={`${HEAD} text-right`}>
                    ·
                  </th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE.board.map((row) => (
                  <tr
                    key={row.name}
                    style={{ borderColor: tone.line }}
                    className="border-b"
                  >
                    <td className={CELL}>
                      <span
                        style={{ color: row.you === true ? tone.accent : tone.muted }}
                        className="mr-2 tabular-nums"
                      >
                        {row.place}
                      </span>
                      {row.name}
                    </td>
                    <td
                      style={{ color: tone.muted }}
                      className={`${CELL} text-right tabular-nums`}
                    >
                      {row.rounds}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex flex-col gap-2">
              {[
                { label: copy.daily, value: SAMPLE.daily },
                { label: copy.weekly, value: SAMPLE.weekly },
              ].map((one) => (
                <div
                  key={one.label}
                  style={{ borderColor: tone.line }}
                  className="flex items-center gap-3 border-b pb-2 text-[13px]"
                >
                  <span className="min-w-0 flex-1">{one.label}</span>
                  <span className="tabular-nums">
                    {one.value.done}/{one.value.target}
                  </span>
                  <span style={{ color: tone.second }} className="text-[12px]">
                    {copy.reward(one.value.reward)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </Shell>
  );
}
