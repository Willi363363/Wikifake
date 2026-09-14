'use client';

// The leaderboard, three arrangements — step L.1, round eight.
//
// Two filters, one ranked list, and the reader somewhere inside it. Nothing
// about J2's surface moves; what varies is where the filters live and how hard
// the page works to find *you* in the list.
//
// **Finding yourself is the job.** A board where a player has to scroll to
// learn their own rank has failed at the only thing they opened it for — G.5
// decided the rank comes back with the board for exactly that reason, and all
// three arrangements have to use it.
//
// **Rooms only, and the page says so.** Solo rounds do not rank, which is a
// fact about the game and not about the design: every arrangement keeps that
// sentence, because a board that silently omitted half somebody's play would be
// read as broken.
import { Shell } from './shell.js';
import type { Copy } from './copy.js';
import { BOARD, type BoardRow } from './sample.js';
import { J2 } from './variants.js';
import type { Theme, Tone } from './tone.js';

export interface BoardProps {
  readonly copy: Copy;
  readonly theme: Theme;
  readonly onAdminPage: boolean;
}

const CHOSEN = { period: 'weekly', region: 'world' };

function Chips({
  label,
  options,
  current,
  tone,
}: {
  readonly label: string;
  readonly options: readonly { readonly id: string; readonly label: string }[];
  readonly current: string;
  readonly tone: Tone;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        style={{ color: tone.muted }}
        className="text-[11px] tracking-[0.08em] uppercase"
      >
        {label}
      </span>
      {options.map((one) => (
        <span
          key={one.id}
          style={
            one.id === current
              ? { background: tone.accent, color: tone.onAccent }
              : { background: tone.surface, color: tone.muted }
          }
          className="rounded-full px-3 py-1.5 text-[13px] font-medium"
        >
          {one.label}
        </span>
      ))}
    </div>
  );
}

function Row({
  row,
  tone,
  big = false,
}: {
  readonly row: BoardRow;
  readonly tone: Tone;
  readonly big?: boolean;
}) {
  const mine = row.you === true;
  return (
    <li
      style={{
        background: mine ? tone.accent : 'transparent',
        color: mine ? tone.onAccent : tone.ink,
      }}
      className={`flex items-center gap-4 rounded-xl px-3 ${big ? 'py-3.5' : 'py-2.5'}`}
    >
      <span
        style={{ color: mine ? tone.onAccent : tone.muted }}
        className="w-7 text-[14px] font-bold tabular-nums"
      >
        {row.rank}
      </span>
      <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">
        {row.name}
      </span>
      <span className={`${big ? 'text-[17px]' : 'text-[15px]'} font-bold tabular-nums`}>
        {row.score}
      </span>
      <span
        style={{ color: mine ? tone.onAccent : tone.muted }}
        className="w-9 text-right text-[12px]"
      >
        {row.when}
      </span>
    </li>
  );
}

const you = BOARD.find((row) => row.you === true) as BoardRow;

/** B1 — filters above, one list, you highlighted where you actually are. */
export function BoardPlain({ copy, theme, onAdminPage }: BoardProps) {
  const tone = J2[theme];
  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="b1-menu">
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-5 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-3">
          <Chips
            label={copy.periodLabel}
            options={copy.periodNames}
            current={CHOSEN.period}
            tone={tone}
          />
          <Chips
            label={copy.regionLabel}
            options={copy.regionNames}
            current={CHOSEN.region}
            tone={tone}
          />
        </div>

        <section style={{ background: tone.surface }} className="rounded-2xl p-3 sm:p-4">
          <ul className="m-0 flex list-none flex-col p-0">
            {BOARD.map((row) => (
              <Row key={row.name} row={row} tone={tone} />
            ))}
          </ul>
        </section>

        <p style={{ color: tone.muted }} className="m-0 text-[12.5px] leading-[1.6]">
          {copy.soloNote}
        </p>
      </main>
    </Shell>
  );
}

/** B2 — your own rank pinned at the top, the list below it. */
export function BoardPinned({ copy, theme, onAdminPage }: BoardProps) {
  const tone = J2[theme];
  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="b2-menu">
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-5 sm:px-8 sm:py-8">
        {/* The answer first. A board you have to scroll to find yourself in has
            failed at the thing you opened it for. */}
        <section
          style={{ background: tone.accent, color: tone.onAccent }}
          className="flex flex-wrap items-baseline justify-between gap-3 rounded-2xl px-5 py-4"
        >
          <span className="text-[15px] font-semibold">{copy.yourRank(you.rank)}</span>
          <span className="text-[26px] leading-none font-bold tabular-nums">
            {you.score}
          </span>
        </section>

        <div className="flex flex-col gap-3">
          <Chips
            label={copy.periodLabel}
            options={copy.periodNames}
            current={CHOSEN.period}
            tone={tone}
          />
          <Chips
            label={copy.regionLabel}
            options={copy.regionNames}
            current={CHOSEN.region}
            tone={tone}
          />
        </div>

        <section style={{ background: tone.surface }} className="rounded-2xl p-3 sm:p-4">
          <ul className="m-0 flex list-none flex-col p-0">
            {BOARD.map((row) => (
              <Row key={row.name} row={row} tone={tone} />
            ))}
          </ul>
        </section>

        <p style={{ color: tone.muted }} className="m-0 text-[12.5px] leading-[1.6]">
          {copy.soloNote}
        </p>
      </main>
    </Shell>
  );
}

/** B3 — a podium, then the rest. The shape a ranking usually wears. */
export function BoardPodium({ copy, theme, onAdminPage }: BoardProps) {
  const tone = J2[theme];
  const top = BOARD.slice(0, 3);
  const rest = BOARD.slice(3);
  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="b3-menu">
      <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-5 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-3">
          <Chips
            label={copy.periodLabel}
            options={copy.periodNames}
            current={CHOSEN.period}
            tone={tone}
          />
          <Chips
            label={copy.regionLabel}
            options={copy.regionNames}
            current={CHOSEN.region}
            tone={tone}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {top.map((row, at) => (
            <section
              key={row.name}
              style={{
                background: at === 0 ? tone.accent : tone.surface,
                color: at === 0 ? tone.onAccent : tone.ink,
              }}
              className="flex flex-col gap-1.5 rounded-2xl p-5"
            >
              <span
                style={{ color: at === 0 ? tone.onAccent : tone.muted }}
                className="text-[12px] font-bold tabular-nums"
              >
                {row.rank}
              </span>
              <span className="truncate text-[17px] font-bold">{row.name}</span>
              <span className="text-[24px] leading-none font-bold tabular-nums">
                {row.score}
              </span>
            </section>
          ))}
        </div>

        <section style={{ background: tone.surface }} className="rounded-2xl p-3 sm:p-4">
          <ul className="m-0 flex list-none flex-col p-0">
            {rest.map((row) => (
              <Row key={row.name} row={row} tone={tone} big />
            ))}
          </ul>
        </section>

        <p style={{ color: tone.muted }} className="m-0 text-[12.5px] leading-[1.6]">
          {copy.soloNote}
        </p>
      </main>
    </Shell>
  );
}
