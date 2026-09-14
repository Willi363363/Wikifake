'use client';

// Candidate J — tiles of unequal size. Step L.1, round four.
//
// The first of three dashboards, and the arrangement is what is being compared
// now, not the palette. Rounds one to three re-skinned one marketing skeleton
// nine times — a centred headline, a button, three numbered columns — which is
// the template that reads as generated whatever colour it wears.
//
// **Play is the largest tile, not a centred button.** It earns the eye by area
// and position rather than by glowing, and it sits among the things that make
// somebody open the site again: the streak, the daily lot, the ranking.
//
// The risk: unequal tiles are a fashion of the last two years, and fashions
// date. In three years this is the layout that will look its age.
import { Shell } from './shell.js';
import type { Copy } from './copy.js';
import { SAMPLE } from './sample.js';
import type { Palette, Theme } from './tone.js';

const FACE = '"Inter", system-ui, -apple-system, "Segoe UI", Arial, sans-serif';

export const BENTO: Palette = {
  light: {
    bg: '#F4F5F3',
    surface: '#FFFFFF',
    line: '#E2E4DF',
    ink: '#15181A',
    muted: '#6A7178',
    accent: '#0F7A5A',
    onAccent: '#FFFFFF',
    second: '#B45309',
    font: FACE,
  },
  dark: {
    bg: '#0E1113',
    surface: '#171B1E',
    line: '#262C31',
    ink: '#EDF0F2',
    muted: '#8B959D',
    accent: '#2DD4A0',
    onAccent: '#04140E',
    second: '#F5A524',
    font: FACE,
  },
};

export interface CandidateProps {
  readonly copy: Copy;
  readonly theme: Theme;
  readonly onAdminPage: boolean;
}

export function CandidateBento({ copy, theme, onAdminPage }: CandidateProps) {
  const tone = BENTO[theme];
  const card = 'rounded-xl border p-4';
  const edge = { background: tone.surface, borderColor: tone.line };

  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="j-menu">
      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-8 sm:py-8">
        <div className="grid gap-3 sm:grid-cols-4">
          {/* The dominant tile. Two columns wide, two rows tall. */}
          <a
            href="#"
            style={{ background: tone.accent, color: tone.onAccent }}
            className="flex min-h-44 flex-col justify-between rounded-xl p-5 sm:col-span-2 sm:row-span-2"
          >
            <span className="text-[15px] font-semibold opacity-80">
              {copy.streak} · {SAMPLE.streak}
            </span>
            <span className="text-[34px] leading-none font-bold tracking-[-0.02em]">
              {copy.play}
            </span>
          </a>

          <div style={edge} className={`${card} sm:col-span-2`}>
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-semibold">{copy.daily}</span>
              <span style={{ color: tone.second }} className="text-[12px]">
                {copy.reward(SAMPLE.daily.reward)}
              </span>
            </div>
            <p style={{ color: tone.muted }} className="m-0 mt-1 text-[12px]">
              {copy.progress(SAMPLE.daily.done, SAMPLE.daily.target)}
            </p>
            <div
              style={{ background: tone.line }}
              className="mt-3 h-2 overflow-hidden rounded-full"
            >
              <span
                style={{
                  background: tone.accent,
                  width: `${String((SAMPLE.daily.done / SAMPLE.daily.target) * 100)}%`,
                }}
                className="block h-full"
              />
            </div>
          </div>

          <div style={edge} className={card}>
            <span style={{ color: tone.muted }} className="text-[11px]">
              {copy.finished}
            </span>
            <p className="m-0 mt-1 text-[26px] leading-none font-bold tabular-nums">
              {SAMPLE.gamesFinished}
            </p>
          </div>

          <div style={edge} className={card}>
            <span style={{ color: tone.muted }} className="text-[11px]">
              {copy.average}
            </span>
            <p className="m-0 mt-1 text-[26px] leading-none font-bold tabular-nums">
              {SAMPLE.averageScore}%
            </p>
          </div>

          <div style={edge} className={`${card} sm:col-span-2`}>
            <span className="text-[13px] font-semibold">{copy.board}</span>
            <ul className="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0">
              {SAMPLE.board.map((row) => (
                <li key={row.name} className="flex items-baseline gap-3 text-[13px]">
                  <span
                    style={{ color: row.you === true ? tone.accent : tone.muted }}
                    className="w-5 tabular-nums"
                  >
                    {row.place}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{row.name}</span>
                  <span style={{ color: tone.muted }} className="tabular-nums">
                    {row.rounds}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div style={edge} className={`${card} sm:col-span-2`}>
            <span className="text-[13px] font-semibold">{copy.finished}</span>
            <ul className="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0">
              {SAMPLE.rounds.slice(0, 4).map((round) => (
                <li key={round.topic} className="flex items-baseline gap-3 text-[13px]">
                  <span className="min-w-0 flex-1 truncate">{round.topic}</span>
                  <span className="tabular-nums">{round.score}%</span>
                  <span
                    style={{ color: tone.muted }}
                    className="w-8 text-right text-[11px]"
                  >
                    {round.when}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </Shell>
  );
}
