// The range control — step I.8.
//
// Links and not buttons, because that is what they are: each preset is a
// different panel at a different address, so it can be bookmarked, shared and
// reloaded. `aria-current` is how the chosen one is announced — an underline
// alone is visible and not audible. The same shape G.5's board chooser has.
//
// **It says which sections it moves**, and that sentence is the honest half of
// this step: the health probes are live and the most-active list is built from
// running totals with no date on them, so neither can honour a range. A control
// that silently left them alone would be a control that lied about two thirds
// of a screen.
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';

import { PRESETS, type Preset, type Range } from './range.js';

export interface RangeChooserProps {
  readonly range: Range;
}

export function RangeChooser({ range }: RangeChooserProps) {
  const t = useTranslations('admin.range');
  const format = useFormatter();

  return (
    <div className="mt-4">
      <nav aria-label={t('label')} className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
          {t('label')}
        </span>
        {PRESETS.map((preset: Preset) => (
          <Link
            key={preset}
            href={`/admin?range=${preset}`}
            aria-current={preset === range.preset ? 'page' : undefined}
            // A chosen tab is a fill carrying `on-fill`; the rest are washes
            // carrying `ink`. Never a fill used as a text colour.
            className={
              preset === range.preset
                ? 'border-3 border-line-strong bg-accent px-2 py-1 text-xs font-bold text-on-fill'
                : 'border-3 border-line-strong bg-surface px-2 py-1 text-xs text-ink'
            }
          >
            {t(`presets.${preset}`)}
          </Link>
        ))}
      </nav>

      <p className="mt-2 text-xs text-muted">
        {range.preset === 'all'
          ? t('coveringAll')
          : t('covering', {
              from: format.dateTime(new Date(range.fromMs), { dateStyle: 'medium' }),
              to: format.dateTime(new Date(range.toMs - 1), { dateStyle: 'medium' }),
            })}
      </p>
      <p className="mt-1 max-w-prose text-xs text-muted">{t('whatItMoves')}</p>
    </div>
  );
}
