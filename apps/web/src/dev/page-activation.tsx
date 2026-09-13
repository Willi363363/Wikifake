// Three Activation pages, one set of figures.
//
// Activation is four counts and the three gaps between them, and that is the
// whole page. What these three disagree about is whether the subject is the
// steps or the gaps — whether the reader is being shown how many arrive, or
// where they are lost.
//
// Two sentences every layout carries, because they are true of the numbers and
// not of the design: the period chooses **who signed up**, not when they
// played; and "returned" is a later day of activity, not a cohort curve — a
// return the next day and a return six months later look the same here.
import { count, percent, type Sample } from './sample-data.js';
import { CARD, Funnel, LABEL, PANEL, Tile } from './parts.js';

export type ActivationLayoutId = 'funnel' | 'losses' | 'steps';

export interface ActivationLayout {
  readonly id: ActivationLayoutId;
  readonly name: string;
  readonly bet: string;
  readonly cost: string;
}

export const ACTIVATION_LAYOUTS: readonly ActivationLayout[] = [
  {
    id: 'funnel',
    name: 'A1 — funnel',
    bet: 'The two rates as headline figures, then the funnel itself: the shape is the argument, and a shrinking bar needs no explaining.',
    cost: 'A funnel shows the survivors. The number that would make you act is the one that fell out, and here it is a subtraction the reader does.',
  },
  {
    id: 'losses',
    name: 'A2 — losses',
    bet: 'The gaps are the page. Three blocks, each naming how many were lost and at which step, because nobody ever fixed a funnel by looking at who stayed.',
    cost: 'It reads as bad news whatever the numbers say, and the healthy shape of the funnel is demoted to a strip.',
  },
  {
    id: 'steps',
    name: 'A3 — steps',
    bet: 'Four cards, each a step with its count, its two shares and the sentence that says what it means. No chart at all — the definitions are the hard part, not the arithmetic.',
    cost: 'Four cards side by side lose the one thing a funnel gives for free: you cannot see the shape.',
  },
];

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

/** One gap, in A2: the people the step above has and this one does not. */
function Loss({
  lost,
  what,
  from,
  to,
  share,
}: {
  readonly lost: number;
  readonly what: string;
  readonly from: string;
  readonly to: string;
  readonly share: number;
}) {
  return (
    <section className={`${CARD} flex flex-col gap-3 p-5`}>
      <span className={LABEL}>
        {from} → {to}
      </span>
      <span className="text-4xl leading-none font-extrabold text-ink">
        − {count(lost)}
      </span>
      <p className="m-0 text-[13px] leading-snug text-ink-2">{what}</p>
      <div className="mt-auto flex items-center gap-3 border-t-3 border-line pt-3">
        <span className="flex h-2.5 min-w-0 flex-1 border-2 border-line-strong bg-bg">
          <span
            className="h-full bg-danger"
            style={{ width: `${String(Math.round(share * 100))}%` }}
          />
        </span>
        <span className="font-mono text-xs font-bold text-ink">{percent(share)}</span>
      </div>
    </section>
  );
}

/** A2 — the gaps are the page. */
export function ActivationLosses({ data }: { readonly data: Sample }) {
  const steps = data.activation.steps;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {steps.slice(1).map((step, at) => {
          const above = steps[at] as (typeof steps)[number];
          const lost = above.count - step.count;
          return (
            <Loss
              key={step.name}
              lost={lost}
              what={step.lost}
              from={above.name}
              to={step.name}
              share={above.count === 0 ? 0 : lost / above.count}
            />
          );
        })}
      </div>

      <section className={`${CARD} flex flex-col gap-3 p-5`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="m-0 text-base font-bold text-ink">What is left, at each step</h2>
          <span className="font-mono text-[11px] text-muted">
            {percent(data.activation.activation)} activation ·{' '}
            {percent(data.activation.returnRate)} returned
          </span>
        </div>
        <Funnel steps={steps} />
        <div className="border-t-3 border-line pt-3">
          <Caveats tight />
        </div>
      </section>
    </div>
  );
}

/** A3 — four cards, and the definitions carry the page. */
export function ActivationSteps({ data }: { readonly data: Sample }) {
  const steps = data.activation.steps;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, at) => (
          <section
            key={step.name}
            className={`${CARD} flex flex-col gap-3 p-5 ${at === 0 ? 'bg-accent' : ''}`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className={LABEL}>
                Step {at + 1} · {step.name}
              </span>
            </div>
            <span className="text-4xl leading-none font-extrabold text-ink">
              {count(step.count)}
            </span>
            <p className="m-0 min-h-16 text-[12.5px] leading-snug text-ink-2">
              {step.why}
            </p>
            <div
              className={`mt-auto grid grid-cols-2 gap-2 border-t-3 pt-3 ${
                at === 0 ? 'border-line-strong' : 'border-line'
              }`}
            >
              <span className="flex flex-col gap-0.5">
                <span className={LABEL}>Of previous</span>
                <span className="font-mono text-sm font-bold text-ink">
                  {step.ofPrevious === null ? '—' : percent(step.ofPrevious)}
                </span>
              </span>
              <span className="flex flex-col gap-0.5">
                <span className={LABEL}>Of created</span>
                <span className="font-mono text-sm font-bold text-ink">
                  {step.ofCreated === null ? '—' : percent(step.ofCreated)}
                </span>
              </span>
            </div>
          </section>
        ))}
      </div>

      <section className={`${PANEL} flex flex-col gap-3 p-4`}>
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <span className="flex items-baseline gap-2">
            <span className={LABEL}>Activation</span>
            <span className="font-mono text-lg font-bold text-ink">
              {percent(data.activation.activation)}
            </span>
          </span>
          <span className="flex items-baseline gap-2">
            <span className={LABEL}>Returned</span>
            <span className="font-mono text-lg font-bold text-ink">
              {percent(data.activation.returnRate)}
            </span>
          </span>
        </div>
        <Caveats tight />
      </section>
    </div>
  );
}
