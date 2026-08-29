'use client';

// The two settings the host owns, and only the host.
//
// Hidden from a guest, and that is presentation and nothing else: C1.7 is
// enforced by the server, which refuses a guest's options whether or not this
// component drew them. Hiding a control the server would refuse is politeness;
// relying on the hiding would be the bug.
//
// `ItemsToggle` becomes a real switch. The current one is a `<div onClick>`:
// not focusable, no role, nothing on Enter or Space, and nothing announcing
// whether items are on — the same defect as the paragraph token, on a control
// that decides how the round is played.
import { Label } from '@wikifake/ui';
import { MAX_TIME_LIMIT_SECONDS, MIN_TIME_LIMIT_SECONDS } from '@wikifake/protocol';
import { useTranslations } from 'next-intl';
import { useId } from 'react';

/** The step the current slider uses. Thirty seconds, from 30 to 600. */
const STEP = 30;

export interface HostSettingsProps {
  readonly timeLimit: number;
  readonly withItems: boolean;
  readonly disabled?: boolean;
  onTimeLimitChange(seconds: number): void;
  onWithItemsChange(withItems: boolean): void;
}

export function HostSettings({
  timeLimit,
  withItems,
  disabled,
  onTimeLimitChange,
  onWithItemsChange,
}: HostSettingsProps) {
  const t = useTranslations('lobby.hostSettings');
  const ids = useId();

  // `90` reads as `1.5min`, as it does today — but the unit and its spacing
  // are the locale's, so each is a whole catalogue message, never a suffix
  // concatenated onto a number.
  const readableLimit = (seconds: number): string =>
    seconds < 60 ? t('seconds', { seconds }) : t('minutes', { minutes: seconds / 60 });

  return (
    <div className="space-y-4">
      <div>
        {/* Associated with the input, which the current label is not: it is a
            sibling `<label>` with no `htmlFor`, so it names nothing. */}
        <Label htmlFor={`${ids}-limit`}>
          {t('timeLimit', { limit: readableLimit(timeLimit) })}
        </Label>
        <input
          id={`${ids}-limit`}
          type="range"
          min={MIN_TIME_LIMIT_SECONDS}
          max={MAX_TIME_LIMIT_SECONDS}
          step={STEP}
          value={timeLimit}
          disabled={disabled}
          className="mt-2 w-full accent-accent"
          onChange={(event) => {
            onTimeLimitChange(Number(event.target.value));
          }}
        />
        <p className="mt-1 flex justify-between text-xs text-muted">
          <span>{readableLimit(MIN_TIME_LIMIT_SECONDS)}</span>
          <span>{readableLimit(MAX_TIME_LIMIT_SECONDS)}</span>
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={withItems}
        disabled={disabled}
        onClick={() => {
          onWithItemsChange(!withItems);
        }}
        className={[
          'flex w-full items-center justify-between rounded-md border px-3.5 py-2.5',
          'text-sm transition-colors outline-none',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
          'disabled:pointer-events-none disabled:opacity-40',
          withItems
            ? 'border-accent-line bg-accent-soft text-accent'
            : 'border-line-strong bg-surface text-ink-2',
        ].join(' ')}
      >
        <span>{t('playWithItems')}</span>
        <span
          aria-hidden
          className={[
            'relative h-5 w-9 shrink-0 rounded-full transition-colors',
            withItems ? 'bg-accent' : 'bg-line-strong',
          ].join(' ')}
        >
          <span
            className={[
              'absolute top-[3px] size-3.5 rounded-full bg-surface shadow-sm transition-[left]',
              withItems ? 'left-[19px]' : 'left-[3px]',
            ].join(' ')}
          />
        </span>
      </button>
    </div>
  );
}
