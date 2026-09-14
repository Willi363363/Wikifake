// The pieces every page of the panel is built from — step K.3.
//
// Lifted from `src/dev/parts.tsx`, where eleven rounds of candidates were drawn
// with them so that what was being compared was the *arrangement* and never the
// tile. They move here on the first page that needs them, and the seven after
// it use the same ones: eight pages each drawing their own tile would be eight
// designs sharing a rail.
//
// **Nothing here reads the catalogue.** A part takes the words it prints, so a
// page decides what a figure is called and this file decides what it looks
// like. That split is what lets the same `Tile` say *Accounts* on one page and
// *Comptes* on the other without knowing either.
//
// **A fill carries `on-fill`, a wash carries `ink`** — the direction's rule, and
// `fills.test.ts` scans these files for the thirty-third place somebody uses a
// fill as a text colour.
import { useFormatter } from 'next-intl';
import type { ReactNode } from 'react';

export const CARD = 'rounded-xl bg-surface';
export const PANEL = 'rounded-lg border border-line bg-bg';
export const LABEL = 'font-mono text-[10px] tracking-[0.12em] text-muted uppercase';

/**
 * A share, as a percentage — or the em dash, when there is no whole.
 *
 * Null and not zero is `shareOf`'s rule all the way to the screen: nobody has
 * signed up is not *nought per cent of people played*, and a panel reading 0%
 * the day before launch would report a failure that has not happened.
 */
export function Percent({
  share,
  nothing = '—',
}: {
  readonly share: number | null;
  readonly nothing?: string;
}) {
  const format = useFormatter();
  return (
    <>
      {share === null
        ? nothing
        : format.number(share, { style: 'percent', maximumFractionDigits: 1 })}
    </>
  );
}

/** A count, in the reader's own digits and grouping. */
export function Count({ value }: { readonly value: number }) {
  const format = useFormatter();
  return <>{format.number(value)}</>;
}

/**
 * A headline figure.
 *
 * `filled` is the one figure a page wants read first, and **at most one per
 * screen**: two things shouted are two things nobody hears.
 */
export function Tile({
  label,
  value,
  note,
  filled = false,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly note?: ReactNode;
  readonly filled?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-lg border border-line-strong p-4 ${
        filled ? 'bg-accent' : 'bg-surface'
      }`}
    >
      <span className={filled ? `${LABEL} text-ink` : LABEL}>{label}</span>
      <span className="text-3xl leading-none font-extrabold tabular-nums text-ink">
        {value}
      </span>
      {note === undefined ? null : (
        <span className={`text-xs ${filled ? 'text-ink-2' : 'text-muted'}`}>{note}</span>
      )}
    </div>
  );
}

/** A small figure inside a panel — no border of its own, no shadow. */
export function Figure({
  label,
  value,
  note,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly note?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className={LABEL}>{label}</span>
      <span className="text-xl leading-none font-bold tabular-nums text-ink">
        {value}
      </span>
      {note === undefined ? null : <span className="text-[11px] text-muted">{note}</span>}
    </div>
  );
}

/** One column of a chart, and what it stands for when read aloud. */
export interface Column {
  readonly label: string;
  readonly value: number;
}

/**
 * A series, day by day.
 *
 * A row of `div`s and not an SVG: the direction's bars are a 3px border and a
 * flat fill, which is exactly what a box already is, and a chart nobody has to
 * load a library for is a chart that cannot fail to load. Each column carries
 * its own `title`, so the figure behind a bar is readable rather than guessed.
 */
export function Sparkline({
  columns,
  height = 'h-20',
}: {
  readonly columns: readonly Column[];
  readonly height?: string;
}) {
  const top = Math.max(...columns.map((column) => column.value), 1);
  return (
    <div className={`flex items-end gap-1 ${height}`}>
      {columns.map((column) => (
        <div
          key={column.label}
          title={`${column.label} · ${String(column.value)}`}
          className="min-w-0 flex-1 bg-accent-line"
          // A zero-height bar is invisible, and invisible reads as missing: the
          // floor is two pixels so a day with nothing in it is still a day.
          style={{
            height: `max(2px, ${String(Math.round((column.value / top) * 100))}%)`,
          }}
        />
      ))}
    </div>
  );
}

/** One bar of a funnel: what it is, how many, and its share of the step above. */
export interface Bar {
  readonly label: string;
  readonly count: number;
  readonly ofPrevious: number | null;
}

/**
 * The funnel, built in order so *where* people are lost is readable.
 *
 * The width is the share of the first step and the number beside it is the
 * share of the step above — two different questions, and a funnel that showed
 * only one of them makes a reader do the other in their head.
 */
export function Funnel({ bars }: { readonly bars: readonly Bar[] }) {
  const top = bars[0]?.count ?? 1;
  return (
    <ol className="m-0 flex list-none flex-col gap-2 p-0">
      {bars.map((bar, at) => (
        <li key={bar.label} className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div
              className={`flex h-9 items-center rounded-lg border border-line-strong px-3 ${
                at === 0
                  ? 'bg-accent'
                  : at === bars.length - 1
                    ? 'bg-bronze'
                    : 'bg-accent-soft'
              }`}
              // A floor of 28%, so the shortest bar still has room for its name.
              style={{ width: `${String(Math.max(28, (bar.count / top) * 100))}%` }}
            >
              <span className="truncate text-[13px] font-bold text-ink">{bar.label}</span>
            </div>
          </div>
          <span className="w-12 shrink-0 text-right font-mono text-[13px] tabular-nums text-muted">
            <Percent share={bar.ofPrevious} />
          </span>
          <span className="w-12 shrink-0 text-right font-mono text-base font-bold tabular-nums text-ink">
            <Count value={bar.count} />
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Two measures, day by day, side by side.
 *
 * Paired rather than stacked: landing and entry are not parts of a whole — the
 * entry screen is reachable from a bookmark without passing the landing at all,
 * which is also why reach can exceed 100 %.
 */
export function PairedBars({
  first,
  second,
  height = 'h-40',
}: {
  readonly first: readonly Column[];
  readonly second: readonly Column[];
  readonly height?: string;
}) {
  const top = Math.max(
    ...first.map((column) => column.value),
    ...second.map((column) => column.value),
    1,
  );
  const tall = (value: number) => `max(2px, ${String(Math.round((value / top) * 100))}%)`;

  return (
    <div className={`flex items-end gap-1.5 ${height}`}>
      {first.map((column, at) => (
        <div
          key={column.label}
          // `h-full` and not only `items-end`: the bars below are sized as a
          // percentage, and a percentage of an auto-height parent is zero.
          className="flex h-full min-w-0 flex-1 items-end gap-px"
        >
          <div
            title={`${column.label} · ${String(column.value)}`}
            className="min-w-0 flex-1 bg-accent-line"
            style={{ height: tall(column.value) }}
          />
          <div
            title={`${column.label} · ${String(second[at]?.value ?? 0)}`}
            className="min-w-0 flex-1 bg-accent"
            style={{ height: tall(second[at]?.value ?? 0) }}
          />
        </div>
      ))}
    </div>
  );
}

/** What a swatch in a chart stands for. */
export function Key({ fill, label }: { readonly fill: string; readonly label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`size-3 border-2 border-line-strong ${fill}`} />
      <span className="text-[12.5px] text-ink-2">{label}</span>
    </span>
  );
}
