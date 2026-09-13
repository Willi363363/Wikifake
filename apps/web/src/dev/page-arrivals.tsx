// Arrivals — settled, and the layout that was chosen.
//
// R1, plus the one-step funnel that R2 was built around: the tiles say how
// many, the funnel says how many were lost between the two, and the chart says
// whether it is going anywhere.
//
// **Not one figure here is a number of people.** J.4's counter holds no
// identifier of any kind, so two loads by one reader and one load by each of
// two readers are the same number, and the page says so rather than footnoting
// it.
//
// Two things the design must not flatten. **Reach can exceed 100 %** — the
// entry screen is reachable from a bookmark without the landing — which is why
// the chart pairs the two instead of stacking them, and why the funnel below
// caps its bar rather than pretending the overflow cannot happen. And before
// the counter was switched on there is no zero, there is no measurement: a
// period reaching back past that date raises a warning instead of drawing one.
import { count, percent, type Sample } from './sample-data.js';
import { CARD, Key, LABEL, PairedBars, Tile } from './parts.js';

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

/** The one step this page is, lifted out of the layout it was drawn for. */
function OneStep({ data }: { readonly data: Sample }) {
  const { traffic } = data;
  const lost = Math.max(0, traffic.landing - traffic.entry);
  return (
    <section className={`${CARD} flex flex-col gap-4 p-5`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="m-0 text-lg font-bold text-ink">Landing → entry</h2>
        <span className="font-mono text-[11px] text-muted">
          the one step this page is
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-full items-center border-3 border-line-strong bg-accent-line px-4">
            <span className="text-sm font-bold text-ink">Landing</span>
          </div>
          <span className="w-20 shrink-0 text-right font-mono text-xl font-bold text-ink">
            {count(traffic.landing)}
          </span>
        </div>

        <div className="flex items-center gap-3 py-0.5 pl-4">
          <svg
            width="14"
            height="20"
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
            className="flex h-12 items-center border-3 border-line-strong bg-accent px-4"
            style={{ width: `${String(Math.min(100, traffic.reach * 100))}%` }}
          >
            <span className="truncate text-sm font-bold text-ink">Entry screen</span>
          </div>
          <span className="ml-auto w-20 shrink-0 text-right font-mono text-xl font-bold text-ink">
            {count(traffic.entry)}
          </span>
        </div>
      </div>
    </section>
  );
}

/** The page. */
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

      <OneStep data={data} />

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
