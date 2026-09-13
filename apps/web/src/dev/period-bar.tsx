'use client';

// The period, above every page.
//
// It sits in the panel's own header rather than inside a page, because it
// belongs to all of them: one selector, one address, and every figure below it
// answers for the same window. The alternative — a control per page — is how
// two screens come to disagree about what "this month" meant.
//
// **It does not move everything, and that is the honest part.** A live probe
// has no history, a cumulative total has no date, and `activeToday` is a fixed
// window whatever the range says. `sample-data.ts` records which is which; the
// bar says so once, here, so no page has to say it twice.
import { useState } from 'react';

import { PERIODS, type Period } from './sample-data.js';

const CHIP =
  'min-h-11 border-3 border-line-strong px-3 py-2 text-[13px] whitespace-nowrap';
const ON = `${CHIP} bg-accent font-bold text-on-fill shadow-sm`;
const OFF = `${CHIP} bg-surface font-medium text-ink`;

/** The last entry is the one a custom range would replace. */
const CUSTOM = 'custom';

export interface PeriodBarProps {
  readonly period: Period;
  readonly onChoose: (period: Period) => void;
}

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="square"
      aria-hidden
    >
      <path d="M3.5 5h17v16h-17zM3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

export function PeriodBar({ period, onChoose }: PeriodBarProps) {
  const [asking, setAsking] = useState(false);
  const custom = PERIODS.find((one) => one.id === CUSTOM) as Period;

  return (
    <div className="flex flex-col gap-2 border-b-3 border-line-strong bg-surface px-5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
          Period
        </span>
        {PERIODS.filter((one) => one.id !== CUSTOM).map((one) => (
          <button
            key={one.id}
            type="button"
            aria-current={one.id === period.id ? 'true' : undefined}
            onClick={() => {
              onChoose(one);
            }}
            className={one.id === period.id ? ON : OFF}
          >
            {one.label}
          </button>
        ))}
        <button
          type="button"
          aria-current={period.id === CUSTOM ? 'true' : undefined}
          onClick={() => {
            setAsking(true);
          }}
          className={`${period.id === CUSTOM ? ON : OFF} flex items-center gap-2`}
        >
          <CalendarIcon />
          {period.id === CUSTOM ? period.label : 'Custom…'}
        </button>
      </div>

      <p className="m-0 font-mono text-[11px] text-muted">
        {period.covering} · the figures below are this period, except a live probe, a
        cumulative total, and “today” — each says so where it appears.
      </p>

      {asking ? (
        <CustomDialog
          onClose={() => {
            setAsking(false);
          }}
          onApply={() => {
            onChoose(custom);
            setAsking(false);
          }}
        />
      ) : null}
    </div>
  );
}

/** September 2026 starts on a Tuesday and runs 30 days. */
const SEPTEMBER = Array.from({ length: 30 }, (_, at) => at + 1);
const BEFORE = [null, null, null, null, null, null, null] as const;

function CustomDialog({
  onClose,
  onApply,
}: {
  readonly onClose: () => void;
  readonly onApply: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Custom period"
        className="flex w-full max-w-lg flex-col border-3 border-line-strong bg-surface shadow-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b-3 border-line-strong p-4">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-lg font-extrabold text-ink">Custom period</h2>
            <p className="m-0 text-xs text-muted">
              Both ends included. The period stays in the address, so it can be bookmarked
              and shared.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-11 shrink-0 items-center justify-center border-3 border-line-strong bg-surface text-ink"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.6}
              strokeLinecap="square"
              aria-hidden
            >
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-end gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
                From
              </span>
              <span className="flex min-h-11 items-center border-3 border-line-strong bg-surface px-3 font-mono text-sm text-ink shadow-sm">
                01 / 06 / 2026
              </span>
            </label>
            <span className="pb-3 font-mono text-sm text-muted">→</span>
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
                To
              </span>
              <span className="flex min-h-11 items-center border-3 border-line-strong bg-surface px-3 font-mono text-sm text-ink shadow-sm">
                13 / 09 / 2026
              </span>
            </label>
          </div>

          <div className="flex flex-col gap-2 border-3 border-line bg-bg p-3">
            <span className="text-center text-sm font-bold text-ink">September 2026</span>
            <div className="grid grid-cols-7 gap-1">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, at) => (
                <span
                  key={`${day}${String(at)}`}
                  className="py-1 text-center font-mono text-[10px] text-muted"
                >
                  {day}
                </span>
              ))}
              {BEFORE.slice(0, 1).map((_, at) => (
                <span key={`pad${String(at)}`} />
              ))}
              {SEPTEMBER.map((day) => (
                <span
                  key={day}
                  className={`flex h-8 items-center justify-center font-mono text-[13px] ${
                    day === 13
                      ? 'border-3 border-line-strong bg-accent font-bold text-on-fill'
                      : day < 13
                        ? 'bg-accent-soft text-ink'
                        : 'text-muted-2'
                  }`}
                >
                  {day}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t-3 border-line-strong bg-bg p-4">
          <span className="font-mono text-xs text-muted">105 days selected</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 border-3 border-line-strong bg-surface px-4 text-sm font-medium text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onApply}
              className="min-h-11 border-3 border-line-strong bg-accent px-4 text-sm font-bold text-on-fill shadow-sm"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
