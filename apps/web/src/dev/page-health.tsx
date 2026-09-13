// Three Health pages, one set of readings.
//
// The only page in the panel that is **not about the period at all**. Three
// probes run when the page loads, and a probe has no history to filter — so
// every layout here has to say, without being asked, that the selector above
// it did nothing.
//
// The reading that earns its place: whether the two services are on the same
// commit. A deployment that half-succeeded leaves a web app and a socket
// server disagreeing, and nothing else on this panel would notice.
import { type Sample, type Service } from './sample-data.js';
import { CARD, Figure, LABEL, PANEL } from './parts.js';

export type HealthLayoutId = 'digest' | 'board' | 'deployment';

export interface HealthLayout {
  readonly id: HealthLayoutId;
  readonly name: string;
  readonly bet: string;
  readonly cost: string;
}

export const HEALTH_LAYOUTS: readonly HealthLayout[] = [
  {
    id: 'digest',
    name: 'H1 — digest',
    bet: 'The shape the panel now has, applied to three rows: a verdict, the table, and what the deployment says about itself.',
    cost: 'A table of three rows is a table for the sake of a table, and the page looks emptier than the others without being simpler.',
  },
  {
    id: 'board',
    name: 'H2 — status board',
    bet: 'One card per service, big enough to read across a room, because this is the page somebody opens when something is wrong and they are in a hurry.',
    cost: 'Three cards for three booleans is a lot of screen, and it is the same three booleans nine times out of ten.',
  },
  {
    id: 'deployment',
    name: 'H3 — the deployment',
    bet: 'The real question is not *are they up* — the site being open answers that — but *are they the same build*. So the commit agreement leads and the probes support it.',
    cost: 'It answers second the question most people came to ask, and a commit hash means nothing to somebody who did not deploy it.',
  },
];

/** Said on every layout, because the selector above did nothing. */
function NotThePeriod() {
  return (
    <p className="m-0 text-[11.5px] leading-relaxed text-muted">
      <strong className="text-ink-2">Live, whatever the period says.</strong> These are
      three probes run when the page loaded — a probe has no history, so the selector
      above does not reach this page.
    </p>
  );
}

function Dot({ up }: { readonly up: boolean }) {
  return (
    <span
      className={`size-3 shrink-0 border-2 border-line-strong ${up ? 'bg-green' : 'bg-danger'}`}
    />
  );
}

function Commit({ data }: { readonly data: Sample }) {
  const { sameCommit, commit } = data.health;
  return (
    <div
      className={`flex items-start gap-3 border-3 border-line-strong p-3 ${
        sameCommit ? 'bg-green-soft' : 'bg-danger-soft'
      }`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="square"
        className="mt-0.5 shrink-0 text-ink"
        aria-hidden
      >
        {sameCommit ? (
          <path d="M4 12.5 9.5 18 20 6.5" />
        ) : (
          <path d="M5 5l14 14M19 5L5 19" />
        )}
      </svg>
      <p className="m-0 text-[12.5px] leading-relaxed text-ink-2">
        {sameCommit ? (
          <>
            Both services are running{' '}
            <strong className="text-ink">the same commit ({commit})</strong>.
          </>
        ) : (
          <>
            The two services are on{' '}
            <strong className="text-ink">different commits</strong> — a deployment is half
            done, or one of them failed.
          </>
        )}
      </p>
    </div>
  );
}

function Probes({ services }: { readonly services: readonly Service[] }) {
  const columns = 'grid grid-cols-[minmax(0,1fr)_5.5rem_5rem] items-center gap-3';
  return (
    <div className="flex flex-col">
      <div className={`${columns} border-b-3 border-line-strong pb-2`}>
        <span className={LABEL}>Service</span>
        <span className={`${LABEL} text-right`}>State</span>
        <span className={`${LABEL} text-right`}>Took</span>
      </div>
      {services.map((service) => (
        <div
          key={service.name}
          className={`${columns} border-b-1 border-line py-2.5 last:border-b-0`}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <Dot up={service.up} />
            <span className="truncate text-[13.5px] text-ink">{service.name}</span>
          </span>
          <span className="text-right font-mono text-[13px] font-bold text-ink">
            {service.up ? 'Up' : 'Down'}
          </span>
          <span className="text-right font-mono text-[13px] text-muted">
            {service.ms === 0 ? '—' : `${String(service.ms)} ms`}
          </span>
        </div>
      ))}
    </div>
  );
}

/** H1 — the house shape. */
export function HealthDigest({ data }: { readonly data: Sample }) {
  const { health } = data;
  const up = health.services.filter((service) => service.up).length;
  return (
    <div className="flex flex-col gap-4">
      <Commit data={data} />

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className={`${CARD} flex flex-col gap-3 p-5`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 className="m-0 text-lg font-bold text-ink">The probes</h2>
            <span className="font-mono text-[11px] text-muted">
              {up} of {health.services.length} up
            </span>
          </div>
          <Probes services={health.services} />
          <div className="border-t-3 border-line pt-3">
            <NotThePeriod />
          </div>
        </section>

        <section className={`${CARD} flex flex-col gap-4 p-5`}>
          <h2 className="m-0 text-lg font-bold text-ink">This deployment</h2>
          <Figure label="Version" value={health.version} />
          <Figure label="Commit" value={health.commit} />
          <Figure
            label="Model"
            value={health.model}
            note={health.llmConfigured ? 'key configured' : 'no key configured'}
          />
          <p className="m-0 mt-auto border-t-3 border-line pt-3 text-[11.5px] leading-relaxed text-muted">
            “Key configured” says a variable exists, not that the key works. Only playing
            a round says that.
          </p>
        </section>
      </div>
    </div>
  );
}

/** H2 — one card per service, readable across a room. */
export function HealthBoard({ data }: { readonly data: Sample }) {
  const { health } = data;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {health.services.map((service) => (
          <section
            key={service.name}
            className={`${CARD} flex flex-col gap-3 p-5 ${service.up ? 'bg-green-soft' : 'bg-danger-soft'}`}
          >
            <span className={LABEL}>{service.name}</span>
            <div className="flex items-center gap-3">
              <span
                className={`size-6 shrink-0 border-3 border-line-strong ${
                  service.up ? 'bg-green' : 'bg-danger'
                }`}
              />
              <span className="text-3xl leading-none font-extrabold text-ink">
                {service.up ? 'Up' : 'Down'}
              </span>
            </div>
            <span className="font-mono text-[12px] text-muted">
              {service.ms === 0
                ? 'answering, this page'
                : `answered in ${String(service.ms)} ms`}
            </span>
          </section>
        ))}
      </div>

      <Commit data={data} />

      <section className={`${PANEL} flex flex-wrap gap-x-10 gap-y-4 p-4`}>
        <Figure label="Version" value={health.version} />
        <Figure label="Commit" value={health.commit} />
        <Figure
          label="Model"
          value={health.model}
          note={health.llmConfigured ? 'key configured' : 'no key configured'}
        />
      </section>

      <section className={`${CARD} p-5`}>
        <NotThePeriod />
      </section>
    </div>
  );
}

/** H3 — the build, first. */
export function HealthDeployment({ data }: { readonly data: Sample }) {
  const { health } = data;
  return (
    <div className="flex flex-col gap-4">
      <section className={`${CARD} flex flex-col gap-5 p-6`}>
        <span className={LABEL}>Are both services the same build?</span>
        <div className="flex flex-wrap items-end gap-5">
          <span className="text-5xl leading-none font-extrabold text-ink">
            {health.sameCommit ? 'Yes' : 'No'}
          </span>
          <span className="pb-1 font-mono text-sm text-muted">
            {health.version} · {health.commit}
          </span>
        </div>
        <p className="m-0 max-w-prose text-[13px] leading-relaxed text-ink-2">
          The site being open already answers whether it is up. This is the question
          nothing else on the panel would notice: a deployment that half succeeded leaves
          the web app and the socket server on different commits, and the game keeps
          serving pages while the two disagree about what the protocol is.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className={`${CARD} flex flex-col gap-3 p-5`}>
          <h2 className="m-0 text-lg font-bold text-ink">The probes behind it</h2>
          <Probes services={health.services} />
        </section>

        <section className={`${CARD} flex flex-col gap-4 p-5`}>
          <h2 className="m-0 text-lg font-bold text-ink">The model</h2>
          <Figure
            label="Name"
            value={health.model}
            note={health.llmConfigured ? 'key configured' : 'no key configured'}
          />
          <p className="m-0 text-[12px] leading-relaxed text-muted">
            “Key configured” says a variable exists, not that the key works. Only playing
            a round says that — which is how the last rotation was checked.
          </p>
          <div className="mt-auto border-t-3 border-line pt-3">
            <NotThePeriod />
          </div>
        </section>
      </div>
    </div>
  );
}
