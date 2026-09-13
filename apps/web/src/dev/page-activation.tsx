// Activation — settled, and the layout that was chosen.
//
// A1: the two rates as headline figures, then the funnel itself. The two it was
// chosen over — the gaps as the page, and four cards carrying the definitions —
// are gone with the question they answered.
//
// Two sentences it keeps, because they are true of the numbers and not of the
// design: the period chooses **who signed up**, not when they played; and
// "returned" is a later day of activity, not a cohort curve.
import { count, percent, type Sample } from './sample-data.js';
import { CARD, Funnel, Tile } from './parts.js';

/** The two sentences, wherever the page puts them. */
function Caveats({ tight = false }: { readonly tight?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 ${tight ? '' : 'pt-1'}`}>
      <p className="m-0 text-[11.5px] leading-relaxed text-muted">
        The period chooses <strong className="text-ink-2">who signed up</strong>, not when
        they played — which is what an activation rate has always meant.
      </p>
      <p className="m-0 text-[11.5px] leading-relaxed text-muted">
        “Returned” is a later day of activity, not a cohort curve: a return the next day
        and a return six months later look the same here.
      </p>
    </div>
  );
}

/** A1 — the two rates, then the funnel. */
export function ActivationFunnel({ data }: { readonly data: Sample }) {
  const { activation } = data;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Activation"
          value={percent(activation.activation)}
          note="of accounts created finish a round"
          filled
        />
        <Tile
          label="Returned"
          value={percent(activation.returnRate)}
          note="of those, active another day"
        />
        <Tile
          label="Accounts created"
          value={count(activation.steps[0]?.count ?? 0)}
          note="in this period"
        />
        <Tile
          label="Finished a round"
          value={count(activation.steps[2]?.count ?? 0)}
          note={`${count(activation.steps[3]?.count ?? 0)} came back`}
        />
      </div>

      <section className={`${CARD} flex flex-col gap-4 p-5`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="m-0 text-lg font-bold text-ink">The funnel</h2>
          <span className="font-mono text-[11px] text-muted">
            share of the step above · count
          </span>
        </div>
        <Funnel steps={activation.steps} />
        <div className="border-t-3 border-line pt-3">
          <Caveats tight />
        </div>
      </section>
    </div>
  );
}
