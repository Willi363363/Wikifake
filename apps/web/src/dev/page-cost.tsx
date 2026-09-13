// Three Cost pages, one set of figures.
//
// The page the owner asked about first, and the one with a decision already
// made behind it: **no rate is written in the repository**. `packages/env`
// says why — a price hard-coded there is wrong within a quarter and silent
// about it — so the panel reports tokens, which are a measurement, and money
// is a multiplication a deployment opts into through
// `MODEL_INPUT_COST_PER_MTOK` and `MODEL_OUTPUT_COST_PER_MTOK`.
//
// These layouts are drawn with the rates set, because that is the state worth
// designing for. Every one of them says which rate it multiplied by, so a
// figure that looks wrong can be traced to the variable rather than to the
// arithmetic.
//
// Two honesties the numbers demand. Some calls report **no token count at
// all** — `input_tokens` is nullable and `sum` skips a null — so the totals
// are missing those rather than understating quietly. And a **failed call
// still spent tokens**, so it is counted rather than dropped.
import { count, euros, percent, type Kind, type Sample } from './sample-data.js';
import { CARD, Figure, LABEL, PANEL, Sparkline, Tile } from './parts.js';

export type CostLayoutId = 'digest' | 'unit' | 'ledger';

export interface CostLayout {
  readonly id: CostLayoutId;
  readonly name: string;
  readonly bet: string;
  readonly cost: string;
}

export const COST_LAYOUTS: readonly CostLayout[] = [
  {
    id: 'digest',
    name: 'K1 — digest',
    bet: 'The shape the panel now has: the spend, the two unit costs, the curve, and the table of what was called.',
    cost: 'The total is the biggest number on a page where the total is the least useful figure — it only means something divided by something.',
  },
  {
    id: 'unit',
    name: 'K2 — unit economics',
    bet: 'What a round costs is the number that decides whether this game can grow. It leads, the total follows, and the arithmetic between them is shown rather than implied.',
    cost: 'A cost per round computed over a quiet month is not the cost per round at scale, and the page cannot say which month you are looking at.',
  },
  {
    id: 'ledger',
    name: 'K3 — ledger',
    bet: 'Tokens are what the panel actually measures; euros are a multiplication. So the page is a ledger of calls and tokens, with the money as a derived column.',
    cost: 'It is the least answerable layout for the one question usually being asked, which is how much this costs.',
  },
];

/** The rate, stated wherever money appears. */
function Rate({ data }: { readonly data: Sample }) {
  return (
    <p className="m-0 font-mono text-[11px] leading-relaxed text-muted">
      {data.cost.model} · {euros(data.cost.inputRate, 3)} in /{' '}
      {euros(data.cost.outputRate, 2)} out per million tokens, from the two environment
      variables. No rate lives in the repository: one written there is wrong within a
      quarter and says nothing when it goes stale.
    </p>
  );
}

/** What the totals are missing, and what they deliberately include. */
function Gaps({ data }: { readonly data: Sample }) {
  return (
    <p className="m-0 text-[11.5px] leading-relaxed text-muted">
      {count(data.cost.failed)} calls failed{' '}
      <strong className="text-ink-2">and still spent tokens</strong>, so they are counted.{' '}
      {count(data.cost.withoutTokens)} reported no token count at all — the totals above
      are missing those rather than quietly understating.
    </p>
  );
}

function KindTable({
  kinds,
  total,
}: {
  readonly kinds: readonly Kind[];
  readonly total: number;
}) {
  const columns = 'grid grid-cols-[minmax(0,1fr)_4rem_3.5rem_5.5rem_5.5rem_5rem] gap-3';
  return (
    <div className="flex flex-col">
      <div className={`${columns} border-b-3 border-line-strong pb-2`}>
        <span className={LABEL}>Kind</span>
        <span className={`${LABEL} text-right`}>Calls</span>
        <span className={`${LABEL} text-right`}>Failed</span>
        <span className={`${LABEL} text-right`}>In</span>
        <span className={`${LABEL} text-right`}>Out</span>
        <span className={`${LABEL} text-right`}>Cost</span>
      </div>
      {kinds.map((kind) => (
        <div key={kind.kind} className={`${columns} border-b-1 border-line py-2.5`}>
          <span className="truncate text-[13.5px] text-ink">{kind.kind}</span>
          <span className="text-right font-mono text-[13px] text-ink">
            {count(kind.calls)}
          </span>
          <span className="text-right font-mono text-[13px] text-muted">
            {count(kind.failed)}
          </span>
          <span className="text-right font-mono text-[13px] text-muted">
            {count(Math.round(kind.inputTokens / 1000))} k
          </span>
          <span className="text-right font-mono text-[13px] text-muted">
            {count(Math.round(kind.outputTokens / 1000))} k
          </span>
          <span className="text-right font-mono text-[13px] font-bold text-ink">
            {euros(kind.spend)}
          </span>
        </div>
      ))}
      <div className={`${columns} py-2.5 font-bold`}>
        <span className="text-[13.5px] text-ink">All</span>
        <span className="text-right font-mono text-[13px] text-ink">
          {count(kinds.reduce((sum, kind) => sum + kind.calls, 0))}
        </span>
        <span className="text-right font-mono text-[13px] text-ink">
          {count(kinds.reduce((sum, kind) => sum + kind.failed, 0))}
        </span>
        <span />
        <span />
        <span className="text-right font-mono text-[13px] text-ink">{euros(total)}</span>
      </div>
    </div>
  );
}

/** K1 — the house shape. */
export function CostDigest({ data }: { readonly data: Sample }) {
  const { cost } = data;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Spend"
          value={euros(cost.spend)}
          note="at the configured rate"
          filled
        />
        <Tile
          label="Per round generated"
          value={euros(cost.perGame, 4)}
          note="not per round served"
        />
        <Tile
          label="Per player"
          value={euros(cost.perPlayer, 3)}
          note="guests included"
        />
        <Tile
          label="Tokens per round"
          value={count(cost.tokensPerGame)}
          note="in and out"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <section className={`${CARD} flex flex-col gap-4 p-5`}>
          <h2 className="m-0 text-lg font-bold text-ink">Spend over the period</h2>
          <Sparkline days={cost.perDay} height="h-40" />
          <div className="mt-auto border-t-3 border-line pt-3">
            <Rate data={data} />
          </div>
        </section>

        <section className={`${CARD} flex flex-col gap-3 p-5`}>
          <h2 className="m-0 text-lg font-bold text-ink">By kind of call</h2>
          <KindTable kinds={cost.byKind} total={cost.spend} />
          <div className="border-t-3 border-line pt-3">
            <Gaps data={data} />
          </div>
        </section>
      </div>
    </div>
  );
}

/** K2 — what a round costs, and the arithmetic that got there. */
export function CostUnit({ data }: { readonly data: Sample }) {
  const { cost, content } = data;
  return (
    <div className="flex flex-col gap-4">
      <section className={`${CARD} flex flex-col gap-5 p-6`}>
        <span className={LABEL}>What a generated round costs</span>
        <div className="flex flex-wrap items-end gap-5">
          <span className="text-6xl leading-none font-extrabold text-ink">
            {euros(cost.perGame, 4)}
          </span>
          <span className="pb-2 text-[13px] text-muted">
            {count(cost.tokensPerGame)} tokens, at the rate below
          </span>
        </div>

        <div className="grid gap-3 border-t-3 border-line pt-4 sm:grid-cols-3">
          <Figure label="Spend" value={euros(cost.spend)} note="over the period" />
          <Figure
            label="÷ rounds generated"
            value={count(content.generated)}
            note={`${count(content.games)} rounds served, ${percent(content.cacheHitRate)} from cache`}
          />
          <Figure
            label="= per round"
            value={euros(cost.perGame, 4)}
            note="what grows with players"
          />
        </div>

        <Rate data={data} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={`${PANEL} flex flex-col gap-2 p-4`}>
          <span className={LABEL}>Per player</span>
          <span className="text-2xl leading-none font-extrabold text-ink">
            {euros(cost.perPlayer, 3)}
          </span>
          <span className="text-[11.5px] text-muted">
            guests included: the model was called for their round too
          </span>
        </section>
        <section className={`${PANEL} flex flex-col gap-2 p-4`}>
          <span className={LABEL}>A thousand rounds would cost</span>
          <span className="text-2xl leading-none font-extrabold text-ink">
            {euros(cost.perGame * 1000)}
          </span>
          <span className="text-[11.5px] text-muted">
            at today's rate and today's cache rate
          </span>
        </section>
        <section className={`${PANEL} flex flex-col gap-2 p-4`}>
          <span className={LABEL}>Cache is doing the work</span>
          <span className="text-2xl leading-none font-extrabold text-ink">
            {percent(content.cacheHitRate)}
          </span>
          <span className="text-[11.5px] text-muted">
            of rounds cost nothing to generate
          </span>
        </section>
      </div>

      <section className={`${CARD} flex flex-col gap-3 p-5`}>
        <KindTable kinds={cost.byKind} total={cost.spend} />
        <div className="border-t-3 border-line pt-3">
          <Gaps data={data} />
        </div>
      </section>
    </div>
  );
}

/** K3 — tokens are the measurement; money is a column. */
export function CostLedger({ data }: { readonly data: Sample }) {
  const { cost } = data;
  return (
    <div className="flex flex-col gap-4">
      <section className={`${PANEL} flex flex-wrap gap-x-10 gap-y-4 p-4`}>
        <Figure
          label="Calls"
          value={count(cost.calls)}
          note={`${count(cost.failed)} failed`}
        />
        <Figure
          label="Input tokens"
          value={`${count(Math.round(cost.inputTokens / 1000))} k`}
        />
        <Figure
          label="Output tokens"
          value={`${count(Math.round(cost.outputTokens / 1000))} k`}
        />
        <Figure
          label="No token count"
          value={count(cost.withoutTokens)}
          note="missing from the totals"
        />
        <Figure label="Spend" value={euros(cost.spend)} note="derived, not measured" />
      </section>

      <section className={`${CARD} flex flex-col gap-4 p-5`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="m-0 text-xl font-bold text-ink">The ledger</h2>
          <span className="font-mono text-[11px] text-muted">
            tokens are measured · euros are a multiplication
          </span>
        </div>
        <KindTable kinds={cost.byKind} total={cost.spend} />
        <Gaps data={data} />
        <div className="border-t-3 border-line pt-3">
          <Rate data={data} />
        </div>
      </section>

      <section className={`${CARD} flex flex-col gap-3 p-5`}>
        <h2 className="m-0 text-lg font-bold text-ink">Spend by day</h2>
        <Sparkline days={cost.perDay} height="h-32" />
      </section>
    </div>
  );
}
