'use client';

// Candidate K — a column of content, and a sidebar. Step L.1, round four.
//
// The oldest arrangement on the web and still the most used: Reddit, Hacker
// News, a forum, a newspaper. A main column you read down, a narrow rail beside
// it for the things that do not change. Nothing centred, nothing oversized.
//
// **Play is a row at the top of the column, not an object.** The bet is that a
// returning player does not need persuading — they need the fastest line to the
// next round, and a full-width row is the largest target a thumb can hit.
//
// The risk: it looks like software rather than a game, and a player arriving for
// the first time sees a list of numbers instead of a reason to start.
import { Shell } from './shell.js';
import type { Copy } from './copy.js';
import { SAMPLE } from './sample.js';
import type { Palette, Theme } from './tone.js';

const FACE = '-apple-system, "Segoe UI", Helvetica, Arial, sans-serif';

export const FEED: Palette = {
  light: {
    bg: '#FAF9F7',
    surface: '#FFFFFF',
    line: '#E3E0DA',
    ink: '#1B1A17',
    muted: '#6F6A61',
    accent: '#C2410C',
    onAccent: '#FFFFFF',
    second: '#15616D',
    font: FACE,
  },
  dark: {
    bg: '#16161A',
    surface: '#1D1D22',
    line: '#2E2E36',
    ink: '#E9E8E4',
    muted: '#94918B',
    accent: '#F2743C',
    onAccent: '#1A0C04',
    second: '#4FC3D9',
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

export function CandidateFeed({ copy, theme, signedIn, onAdminPage }: CandidateProps) {
  const tone = FEED[theme];

  if (!signedIn) {
    return (
      <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="k-menu">
        <main className="mx-auto grid max-w-5xl gap-8 px-4 py-6 sm:px-8 lg:grid-cols-[1fr_260px]">
          <div>
            <a
              href="#"
              style={{ background: tone.accent, color: tone.onAccent }}
              className="flex items-center justify-between rounded-md px-5 py-4"
            >
              <span className="text-[18px] font-bold">{copy.play}</span>
              <span className="text-[13px] opacity-85">{copy.guest}</span>
            </a>

            {/* The column carries the explanation a visitor needs, in the place
                where a returning player has their own rounds. */}
            <p className="mt-6 mb-0 text-[16px] leading-[1.7]">{copy.description}</p>

            <ol className="m-0 mt-6 flex list-none flex-col gap-5 p-0">
              {copy.beats.map((beat, at) => (
                <li
                  key={beat.title}
                  style={{ borderColor: tone.line }}
                  className="border-t pt-4"
                >
                  <span
                    style={{ color: tone.second }}
                    className="text-[12px] font-semibold tabular-nums"
                  >
                    {at + 1}
                  </span>
                  <h2 className="mt-1 mb-1.5 text-[15px] font-bold">{beat.title}</h2>
                  <p
                    style={{ color: tone.muted }}
                    className="m-0 text-[13.5px] leading-[1.7]"
                  >
                    {beat.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <aside className="flex flex-col gap-5">
            <section style={{ borderColor: tone.line }} className="rounded-md border p-4">
              <h2 className="m-0 text-[12px] font-bold tracking-[0.06em] uppercase">
                {copy.keepTitle}
              </h2>
              <p
                style={{ color: tone.muted }}
                className="m-0 mt-2 text-[12.5px] leading-[1.6]"
              >
                {copy.keepLead}
              </p>
              <a
                href="#"
                style={{ color: tone.accent }}
                className="mt-2.5 inline-block text-[13px] font-bold"
              >
                {copy.keepCta} →
              </a>
            </section>

            <section style={{ borderColor: tone.line }} className="rounded-md border p-4">
              <h2 className="m-0 text-[12px] font-bold tracking-[0.06em] uppercase">
                {copy.board}
              </h2>
              <ol className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
                {SAMPLE.board
                  .filter((row) => row.you !== true)
                  .map((row) => (
                    <li
                      key={row.name}
                      className="flex items-baseline gap-2.5 text-[13px]"
                    >
                      <span style={{ color: tone.muted }} className="w-4 tabular-nums">
                        {row.place}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{row.name}</span>
                      <span style={{ color: tone.muted }} className="tabular-nums">
                        {row.rounds}
                      </span>
                    </li>
                  ))}
              </ol>
            </section>
          </aside>
        </main>
      </Shell>
    );
  }

  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="k-menu">
      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-6 sm:px-8 lg:grid-cols-[1fr_260px]">
        <div>
          {/* The fastest line to the next round: a full-width row, which is the
              largest target a thumb can hit. */}
          <a
            href="#"
            style={{ background: tone.accent, color: tone.onAccent }}
            className="flex items-center justify-between rounded-md px-5 py-4"
          >
            <span className="text-[18px] font-bold">{copy.play}</span>
            <span className="text-[13px] opacity-85">
              {copy.streak} · {SAMPLE.streak}
            </span>
          </a>

          <h2 className="mt-8 mb-3 text-[13px] font-bold tracking-[0.06em] uppercase">
            {copy.finished}
          </h2>
          <ul
            style={{ borderColor: tone.line }}
            className="m-0 list-none divide-y rounded-md border p-0"
          >
            {SAMPLE.rounds.map((round) => (
              <li
                key={round.topic}
                style={{ borderColor: tone.line }}
                className="flex items-baseline gap-4 px-4 py-3"
              >
                <span className="min-w-0 flex-1 truncate text-[15px]">{round.topic}</span>
                <span style={{ color: tone.muted }} className="text-[12.5px]">
                  {round.found}/{round.total}
                </span>
                <span className="w-12 text-right text-[15px] font-semibold tabular-nums">
                  {round.score}%
                </span>
                <span
                  style={{ color: tone.muted }}
                  className="w-8 text-right text-[12px]"
                >
                  {round.when}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <aside className="flex flex-col gap-5">
          <section style={{ borderColor: tone.line }} className="rounded-md border p-4">
            <h2 className="m-0 text-[12px] font-bold tracking-[0.06em] uppercase">
              {copy.quests}
            </h2>
            {[
              { label: copy.daily, value: SAMPLE.daily },
              { label: copy.weekly, value: SAMPLE.weekly },
            ].map((one) => (
              <div key={one.label} className="mt-3">
                <div className="flex items-baseline justify-between text-[13px]">
                  <span>{one.label}</span>
                  <span style={{ color: tone.muted }} className="tabular-nums">
                    {one.value.done}/{one.value.target}
                  </span>
                </div>
                <div
                  style={{ background: tone.line }}
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full"
                >
                  <span
                    style={{
                      background: tone.second,
                      width: `${String((one.value.done / one.value.target) * 100)}%`,
                    }}
                    className="block h-full"
                  />
                </div>
              </div>
            ))}
          </section>

          <section style={{ borderColor: tone.line }} className="rounded-md border p-4">
            <h2 className="m-0 text-[12px] font-bold tracking-[0.06em] uppercase">
              {copy.board}
            </h2>
            <ol className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
              {SAMPLE.board.map((row) => (
                <li key={row.name} className="flex items-baseline gap-2.5 text-[13px]">
                  <span
                    style={{ color: row.you === true ? tone.accent : tone.muted }}
                    className="w-4 tabular-nums"
                  >
                    {row.place}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{row.name}</span>
                  <span style={{ color: tone.muted }} className="tabular-nums">
                    {row.rounds}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <p style={{ color: tone.muted }} className="m-0 text-[12.5px]">
            {copy.coins(SAMPLE.coins)}
          </p>
        </aside>
      </main>
    </Shell>
  );
}
