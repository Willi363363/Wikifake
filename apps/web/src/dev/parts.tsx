// The pieces the three Overview layouts are built from.
//
// Shared deliberately: three layouts that also drew their own tiles would be
// three designs, and what is being compared is the arrangement.
import { percent, type FunnelStep, type Service } from './sample-data.js';

export const CARD = 'border-3 border-line-strong bg-surface shadow-md';
export const PANEL = 'border-3 border-line bg-bg';
export const LABEL = 'font-mono text-[10px] tracking-[0.12em] text-muted uppercase';

export function Tile({
  label,
  value,
  note,
  filled = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
  /** The one figure a layout wants read first. At most one per screen. */
  readonly filled?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-1.5 border-3 border-line-strong p-4 shadow-md ${
        filled ? 'bg-accent' : 'bg-surface'
      }`}
    >
      <span className={filled ? `${LABEL} text-ink` : LABEL}>{label}</span>
      <span className="text-3xl leading-none font-extrabold text-ink">{value}</span>
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
  readonly value: string;
  readonly note?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className={LABEL}>{label}</span>
      <span className="text-xl leading-none font-bold text-ink">{value}</span>
      {note === undefined ? null : <span className="text-[11px] text-muted">{note}</span>}
    </div>
  );
}

export function Sparkline({
  days,
  height = 'h-20',
}: {
  readonly days: readonly number[];
  readonly height?: string;
}) {
  const top = Math.max(...days, 1);
  return (
    <div className={`flex items-end gap-1 ${height}`}>
      {days.map((value, at) => (
        <div
          key={`${String(at)}-${String(value)}`}
          className={`min-w-0 flex-1 border-3 border-line-strong ${
            at === days.length - 1 ? 'bg-accent' : 'bg-accent-line'
          }`}
          style={{ height: `${String(Math.round((value / top) * 100))}%` }}
        />
      ))}
    </div>
  );
}

export function Funnel({ steps }: { readonly steps: readonly FunnelStep[] }) {
  const top = steps[0]?.count ?? 1;
  return (
    <div className="flex flex-col gap-2">
      {steps.map((step, at) => (
        <div key={step.name} className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div
              className={`flex h-9 items-center border-3 border-line-strong px-3 ${
                at === 0
                  ? 'bg-accent'
                  : at === steps.length - 1
                    ? 'bg-bronze'
                    : 'bg-accent-soft'
              }`}
              style={{ width: `${String(Math.max(28, (step.count / top) * 100))}%` }}
            >
              <span className="truncate text-[13px] font-bold text-ink">{step.name}</span>
            </div>
          </div>
          <span className="w-11 shrink-0 text-right font-mono text-[13px] text-muted">
            {step.ofPrevious === null ? '—' : percent(step.ofPrevious)}
          </span>
          <span className="w-10 shrink-0 text-right font-mono text-base font-bold text-ink">
            {step.count}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Health({
  services,
  sameCommit,
}: {
  readonly services: readonly Service[];
  readonly sameCommit: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {services.map((service) => (
        <span key={service.name} className="flex items-center gap-2">
          <span
            className={`size-2.5 border-2 border-line-strong ${
              service.up ? 'bg-green' : 'bg-danger'
            }`}
          />
          <span className="text-[13px] text-ink-2">{service.name}</span>
          {service.ms > 0 ? (
            <span className="font-mono text-[11px] text-muted">
              {String(service.ms)} ms
            </span>
          ) : null}
        </span>
      ))}
      <span className="font-mono text-[11px] text-muted">
        {sameCommit ? 'same commit' : 'commits differ'}
      </span>
    </div>
  );
}

/** The way into a group, from a summary of it. */
export function Into({ label }: { readonly label: string }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-ink-2 uppercase">
      {label}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="square"
        aria-hidden
      >
        <path d="M4 12h15M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}
