// Rounds — step K.7, the two modes the owner chose.
//
// A card each for solo and rooms, then one strip for both together. The two
// layouts it was chosen over — the house digest, and the seat funnel as the
// page — are gone with the question they answered.
//
// **The comparison is the page.** Solo and rooms are not two slices of one
// number: they are two games, with different abandon behaviour, and a table
// that listed them as rows made the reader do the comparison the page exists
// for. Two cards do it by being beside each other.
//
// **A seat is not a round**, and this page falls apart if the two are conflated.
// A solo round has one seat, a room has as many as it had players, and the
// abandon rate is a share of *seats in rounds that have ended* — a seat in a
// round still running has abandoned nothing.
//
// **And it cannot be split by screen**, which is what track I asked for and
// could not have: typing a topic, voting and waiting for generation leave no
// row anywhere, so the split is by mode.
import { useTranslations } from 'next-intl';

import type { GamesView, Mode, ModeRow } from './games.js';
import { CARD, Count, Figure, LABEL, PANEL, Percent } from './parts.js';

export interface GamesSectionProps {
  readonly games: GamesView;
}

/** One mode, given a card of its own. */
function ModeCard({ row, filled }: { readonly row: ModeRow; readonly filled: boolean }) {
  const t = useTranslations('admin.games');

  return (
    <section
      aria-label={t(`modes.${row.mode as Mode}`)}
      className={`${CARD} flex flex-col gap-4 p-5 ${filled ? 'bg-accent' : ''}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="m-0 text-xl font-bold text-ink">
          {t(`modes.${row.mode as Mode}`)}
        </h2>
        <span className="font-mono text-[11px] text-muted">
          {t('stillRunning', { count: row.open })}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-4xl leading-none font-extrabold tabular-nums text-ink">
          <Count value={row.rounds} />
        </span>
        <span className={filled ? `${LABEL} text-ink` : LABEL}>
          {t('columns.rounds')}
        </span>
      </div>

      <div
        className={`grid grid-cols-2 gap-4 border-t-3 pt-4 ${
          filled ? 'border-line-strong' : 'border-line'
        }`}
      >
        <Figure
          label={t('columns.seats')}
          value={<Count value={row.seats} />}
          note={t('submitted', { count: row.submitted })}
        />
        <Figure
          label={t('columns.abandoned')}
          value={<Percent share={row.abandonRate} nothing={t('noRounds')} />}
          note={t('seats', { count: row.abandoned })}
        />
      </div>

      {/* The rate as a length, under the figure that already says it in words:
          a bar nobody can read a number off is decoration, and decoration that
          repeats a fact is how a card is scanned rather than parsed. */}
      <div aria-hidden className="flex h-3 border-3 border-line-strong bg-bg">
        <span
          className="h-full bg-danger"
          style={{ width: `${String(Math.round((row.abandonRate ?? 0) * 100))}%` }}
        />
      </div>
    </section>
  );
}

export function GamesSection({ games }: GamesSectionProps) {
  const t = useTranslations('admin.games');

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {games.rows.map((row, at) => (
          <ModeCard key={row.mode} row={row} filled={at === 0} />
        ))}
      </div>

      {/* The total is summed from the rows above rather than asked for
          separately: a third query with its own `where` clause is a third
          chance to disagree with the two it is a total of. */}
      <section
        aria-label={t('bothModes')}
        className={`${PANEL} flex flex-wrap items-center gap-x-10 gap-y-4 p-4`}
      >
        <span className={LABEL}>{t('bothModes')}</span>
        <Figure
          label={t('columns.rounds')}
          value={<Count value={games.total.rounds} />}
        />
        <Figure label={t('columns.seats')} value={<Count value={games.total.seats} />} />
        <Figure
          label={t('abandonRate')}
          value={<Percent share={games.total.abandonRate} nothing={t('noRounds')} />}
        />
      </section>

      <section className={`${CARD} flex flex-col gap-2 p-5`}>
        <p className="m-0 max-w-prose text-[12px] leading-relaxed text-ink-2">
          {t('abandonWhy')}
        </p>
        <p className="m-0 max-w-prose text-[11.5px] leading-relaxed text-muted">
          {t('caveat')}
        </p>
      </section>
    </div>
  );
}
