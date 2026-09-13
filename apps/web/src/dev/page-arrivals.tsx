// Three Arrivals pages, one set of figures.
//
// This is the most misreadable page in the panel, and the layouts are judged on
// how well they stop the misreading. Two numbers, a ratio between them, and a
// series over time — and **none of them is a number of people**. The counter
// holds no identifier of any kind (J.4), so two loads by one reader and one
// load by each of two readers are the same number here.
//
// Two consequences the design has to carry rather than footnote:
//
//   - **Reach can exceed 100 %.** The entry screen is reachable from a
//     bookmark without passing the landing, so the two are not a whole and its
//     part — which is also why the chart pairs them instead of stacking them.
//   - **Before the counter was switched on there is no zero, there is no
//     measurement.** A period reaching back past that date is not comparable
//     with one that does not, and a chart drawing zero there would be drawing
//     a reading nobody took.
import { count, percent, type Sample } from './sample-data.js';
import { CARD, Key, LABEL, PairedBars, PANEL, Tile } from './parts.js';

export type ArrivalsLayoutId = 'digest' | 'step' | 'trend';

export interface ArrivalsLayout {
  readonly id: ArrivalsLayoutId;
  readonly name: string;
  readonly bet: string;
  readonly cost: string;
}

export const ARRIVALS_LAYOUTS: readonly ArrivalsLayout[] = [
  {
    id: 'digest',
    name: 'R1 — digest',
    bet: 'The shape the other three pages now share: the figures, then the chart, then the day table for anybody who wants the rows.',
    cost: 'Three tiles for two numbers and their ratio is a lot of furniture, and the caveat that these are not people ends up under the chart.',
  },
  {
    id: 'step',
    name: 'R2 — one step',
    bet: 'Arrivals is a funnel with a single step — landing to entry — so it is drawn as one, with the reach as the gap and the two loads as the bars.',
    cost: 'Drawing it as a funnel says the two are a whole and its part, and they are not: reach can pass 100 %, which a funnel cannot show.',
  },
  {
    id: 'trend',
    name: 'R3 — trend',
    bet: 'The chart is the page. This section exists to answer *is anybody arriving* week after week, and that question is a shape over time, not a total.',
    cost: 'The totals shrink to a strip, and on a 24-hour period there is almost no shape left to look at.',
  },
];

/** The sentence this page cannot be built without. */
function NotPeople() {
  return (
    <p className="m-0 text-[11.5px] leading-relaxed text-muted">
      These are <strong className="text-ink-2">page loads, not people</strong>: the
      counter holds no identifier of any kind, so two loads by one reader and one load by
      each of two readers give the same number. Reach can pass 100 % — the entry screen is
      reachable from a bookmark, without the landing.
    </p>
  );
}

/** Shown only when the period reaches back past the day counting began. */
function BeforeCounting({ since }: { readonly since: string }) {
  return (
    <div className="flex items-start gap-3 border-3 border-line-strong bg-warn-soft p-3">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="square"
        className="mt-0.5 shrink-0 text-ink"
        aria-hidden
      >
        <path d="M12 3 1.5 21h21z" />
        <path d="M12 10v5M12 17.5h.01" />
      </svg>
      <p className="m-0 text-[12px] leading-relaxed text-ink-2">
        Counting began on <strong className="text-ink">{since}</strong>. This period
        reaches back further, and those days were <strong>not counted</strong> rather than
        empty — two periods straddling that date are not comparable.
      </p>
    </div>
  );
}

function DayTable({ data }: { readonly data: Sample }) {
  const { days, entryDays } = data.traffic;
  // Newest first, the way `readTraffic` folds them.
  const rows = days
    .map((landing, at) => ({ landing, entry: entryDays[at] ?? 0 }))
    .reverse();
  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-[minmax(0,1fr)_5rem_5rem] gap-3 border-b-3 border-line-strong pb-2">
        <span className={LABEL}>Day</span>
        <span className={`${LABEL} text-right`}>Landing</span>
        <span className={`${LABEL} text-right`}>Entry</span>
      </div>
      {rows.map((row, at) => (
        <div
          key={`${String(at)}-${String(row.landing)}`}
          className="grid grid-cols-[minmax(0,1fr)_5rem_5rem] gap-3 border-b-1 border-line py-2 last:border-b-0"
        >
          <span className="font-mono text-[12.5px] text-ink-2">
            {at === 0 ? 'Today' : `${String(at)} d ago`}
          </span>
          <span className="text-right font-mono text-[13px] font-bold text-ink">
            {count(row.landing)}
          </span>
          <span className="text-right font-mono text-[13px] text-muted">
            {count(row.entry)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** R1 — the shape the panel now has. */
export function ArrivalsDigest({ data }: { readonly data: Sample }) {
  const { traffic } = data;
  return (
    <div className="flex flex-col gap-4">
      {traffic.beforeCounting ? <BeforeCounting since={traffic.since} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Landing" value={count(traffic.landing)} note="page loads" />
        <Tile label="Entry screen" value={count(traffic.entry)} note="page loads" />
        <Tile
          label="Reach"
          value={percent(traffic.reach)}
          note="of landing loads reached entry"
          filled
        />
        <Tile
          label="Counting since"
          value={traffic.since.replace(' 2026', '')}
          note="nothing exists before it"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className={`${CARD} flex flex-col gap-4 p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <h2 className="m-0 text-lg font-bold text-ink">Day by day</h2>
            <div className="flex gap-4">
              <Key fill="bg-accent-line" label="Landing" />
              <Key fill="bg-accent" label="Entry" />
            </div>
          </div>
          <PairedBars first={traffic.days} second={traffic.entryDays} />
          <div className="border-t-3 border-line pt-3">
            <NotPeople />
          </div>
        </section>

        <section className={`${CARD} flex flex-col gap-3 p-5`}>
          <h2 className="m-0 text-lg font-bold text-ink">The rows</h2>
          <DayTable data={data} />
        </section>
      </div>
    </div>
  );
}

/** R2 — a funnel with one step. */
export function ArrivalsStep({ data }: { readonly data: Sample }) {
  const { traffic } = data;
  const lost = Math.max(0, traffic.landing - traffic.entry);
  return (
    <div className="flex flex-col gap-4">
      {traffic.beforeCounting ? <BeforeCounting since={traffic.since} /> : null}

      <section className={`${CARD} flex flex-col gap-5 p-6`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="m-0 text-lg font-bold text-ink">Landing → entry</h2>
          <span className="font-mono text-[11px] text-muted">
            counting since {traffic.since}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-full items-center border-3 border-line-strong bg-accent-line px-4">
              <span className="text-sm font-bold text-ink">Landing</span>
            </div>
            <span className="w-20 shrink-0 text-right font-mono text-2xl font-bold text-ink">
              {count(traffic.landing)}
            </span>
          </div>

          <div className="flex items-center gap-3 py-1 pl-4">
            <svg
              width="14"
              height="22"
              viewBox="0 0 14 22"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="square"
              className="text-muted"
              aria-hidden
            >
              <path d="M7 1v16M2 13l5 6 5-6" />
            </svg>
            <span className="text-[12.5px] text-muted">
              <strong className="text-ink">− {count(lost)}</strong> landing loads did not
              reach the entry screen
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div
              className="flex h-14 items-center border-3 border-line-strong bg-accent px-4"
              style={{ width: `${String(Math.min(100, traffic.reach * 100))}%` }}
            >
              <span className="truncate text-sm font-bold text-ink">Entry screen</span>
            </div>
            <span className="ml-auto w-20 shrink-0 text-right font-mono text-2xl font-bold text-ink">
              {count(traffic.entry)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-3 border-t-3 border-line pt-4">
          <span className={LABEL}>Reach</span>
          <span className="font-mono text-3xl font-extrabold text-ink">
            {percent(traffic.reach)}
          </span>
        </div>

        <NotPeople />
      </section>

      <section className={`${PANEL} flex flex-col gap-3 p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <span className={LABEL}>Day by day</span>
          <div className="flex gap-4">
            <Key fill="bg-accent-line" label="Landing" />
            <Key fill="bg-accent" label="Entry" />
          </div>
        </div>
        <PairedBars first={traffic.days} second={traffic.entryDays} height="h-24" />
      </section>
    </div>
  );
}

/** R3 — the chart is the page. */
export function ArrivalsTrend({ data }: { readonly data: Sample }) {
  const { traffic } = data;
  return (
    <div className="flex flex-col gap-4">
      {traffic.beforeCounting ? <BeforeCounting since={traffic.since} /> : null}

      <section className={`${PANEL} flex flex-wrap gap-x-10 gap-y-4 p-4`}>
        <span className="flex flex-col gap-0.5">
          <span className={LABEL}>Landing</span>
          <span className="font-mono text-xl leading-none font-bold text-ink">
            {count(traffic.landing)}
          </span>
        </span>
        <span className="flex flex-col gap-0.5">
          <span className={LABEL}>Entry</span>
          <span className="font-mono text-xl leading-none font-bold text-ink">
            {count(traffic.entry)}
          </span>
        </span>
        <span className="flex flex-col gap-0.5">
          <span className={LABEL}>Reach</span>
          <span className="font-mono text-xl leading-none font-bold text-ink">
            {percent(traffic.reach)}
          </span>
        </span>
        <span className="flex flex-col gap-0.5">
          <span className={LABEL}>Counting since</span>
          <span className="font-mono text-xl leading-none font-bold text-ink">
            {traffic.since.replace(' 2026', '')}
          </span>
        </span>
      </section>

      <section className={`${CARD} flex flex-col gap-4 p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <h2 className="m-0 text-xl font-bold text-ink">Arrivals over the period</h2>
          <div className="flex gap-4">
            <Key fill="bg-accent-line" label="Landing" />
            <Key fill="bg-accent" label="Entry" />
          </div>
        </div>

        <PairedBars first={traffic.days} second={traffic.entryDays} height="h-72" />

        <div className="flex items-center justify-between border-t-3 border-line pt-3">
          <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
            Oldest
          </span>
          <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
            Today · {count(traffic.days[traffic.days.length - 1] ?? 0)} landing
          </span>
        </div>

        <NotPeople />
      </section>
    </div>
  );
}
