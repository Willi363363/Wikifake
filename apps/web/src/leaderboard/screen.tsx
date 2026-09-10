// The board screen, world and regional — step G.5.
//
// **A server component with no client component in it at all**, which is worth
// saying because a board looks like something that wants tabs and state. It
// does not: a period and a region are two links each, the server renders the
// board they ask for, and a browser with no JavaScript gets every one of them.
// State would buy a slightly faster switch and cost the page working at all in
// the degraded paths C.6 measured.
//
// The pseudonym is the only thing a row shows about a player, which is E.3.3's
// promise: the email appears in no room, no leaderboard and no shared score.
import { BOARD_PERIOD_IDS, REGION_IDS, type RegionId } from '@wikifake/protocol';

import { BOARD_MIN_PLAYERS } from './board.js';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';

import type { BoardView } from './board.js';

export interface BoardScreenProps {
  readonly board: BoardView;
}

/** The four region choices, world first. `null` is the world board. */
const REGION_CHOICES: readonly (RegionId | null)[] = [null, ...REGION_IDS];

/** `?period=…&region=…`, with the world board leaving `region` off entirely. */
function boardHref(period: string, region: RegionId | null): string {
  const query = new URLSearchParams({ period });
  if (region !== null) query.set('region', region);
  return `/leaderboard?${query.toString()}`;
}

/**
 * One row of chooser links.
 *
 * Links and not buttons, because that is what they are: each one is a different
 * board at a different address, so it can be opened in a tab, bookmarked and
 * shared. `aria-current` is how the chosen one is announced — the underline
 * alone would be visible and not audible.
 */
function Chooser({
  label,
  options,
}: {
  readonly label: string;
  readonly options: readonly {
    readonly key: string;
    readonly text: string;
    readonly href: string;
    readonly current: boolean;
  }[];
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
        {label}
      </span>
      {options.map((option) => (
        <Link
          key={option.key}
          href={option.href}
          aria-current={option.current ? 'page' : undefined}
          // A chosen tab is a fill carrying `on-fill`; the rest are washes
          // carrying `ink`. Never a fill used as a text colour — `fills.test.ts`.
          className={
            option.current
              ? 'border-3 border-line-strong bg-accent px-2 py-1 text-xs font-bold text-on-fill'
              : 'border-3 border-line-strong bg-surface px-2 py-1 text-xs text-ink'
          }
        >
          {option.text}
        </Link>
      ))}
    </nav>
  );
}

export function BoardScreen({ board }: BoardScreenProps) {
  const t = useTranslations('leaderboard');
  const format = useFormatter();

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-10">
      <h1 className="text-center text-3xl text-ink">{t('title')}</h1>
      {/* Said on the screen rather than left to be inferred from an empty
          board: the boards rank room rounds, and why. */}
      <p className="mx-auto mt-2 max-w-prose text-center text-sm text-muted">
        {t('lead')}
      </p>

      <div className="mt-8 space-y-3">
        <Chooser
          label={t('periodLabel')}
          options={BOARD_PERIOD_IDS.map((period) => ({
            key: period,
            text: t(`periods.${period}`),
            href: boardHref(period, board.region),
            current: period === board.period,
          }))}
        />
        <Chooser
          label={t('regionLabel')}
          options={REGION_CHOICES.map((region) => ({
            key: region ?? 'world',
            text: t(`regions.${region ?? 'world'}`),
            href: boardHref(board.period, region),
            current: region === board.region,
          }))}
        />
      </div>

      {!board.open ? (
        /*
         * Step G.6 — two sentences, because the two states are not the same
         * thing to a player.
         *
         * **Nobody has played** is an invitation: open a room and be the first.
         * **Somebody has, but not enough** is a promise with a number in it —
         * "opens once ten players have played, four so far" — which is a great
         * deal better than a bare *soon*, and reveals a count rather than a
         * name.
         *
         * The rows are not merely unrendered here: `readBoard` never handed them
         * over. Hiding them in the markup would be a promise; not having them is
         * a fact.
         */
        <div className="mt-8 border-3 border-line-strong bg-surface p-6 text-center shadow-md">
          {board.players === 0 ? (
            <p className="text-base text-ink">{t('empty')}</p>
          ) : (
            <>
              <p className="text-base text-ink">
                {t('opensSoon', { needed: BOARD_MIN_PLAYERS })}
              </p>
              <p className="mt-2 font-mono text-sm tabular-nums text-muted">
                {t('soFar', { count: board.players })}
              </p>
              {/* The all-time board needs the same ten players but has every
                  period to find them in, so it is the one that opens first. Not
                  offered when it is the board being looked at. */}
              {board.period === 'allTime' ? null : (
                <p className="mt-2 text-sm text-muted">
                  <Link
                    href={boardHref('allTime', board.region)}
                    className="text-ink underline"
                  >
                    {t('openFirst')}
                  </Link>
                </p>
              )}
            </>
          )}
          <p className="mt-4">
            <Link href="/play" className="text-ink underline">
              {t('play')}
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto border-3 border-line-strong bg-surface shadow-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-3 border-line-strong">
                <th scope="col" className="px-3 py-2 text-left text-muted">
                  {t('columns.rank')}
                </th>
                <th scope="col" className="px-3 py-2 text-left text-muted">
                  {t('columns.player')}
                </th>
                <th scope="col" className="px-3 py-2 text-right text-muted">
                  {t('columns.score')}
                </th>
                <th scope="col" className="px-3 py-2 text-right text-muted">
                  {t('columns.when')}
                </th>
              </tr>
            </thead>
            <tbody>
              {board.rows.map((row, index) => (
                <tr key={row.userId + row.finishedAt.toISOString()}>
                  {/* The rank is the row's position and not a stored number —
                      G.2 stores no rank, because a rank is only true of one
                      board at one moment. */}
                  <td className="px-3 py-2 font-mono tabular-nums text-muted">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2 text-ink">{row.displayName}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                    {format.number(row.score)}
                  </td>
                  <td className="px-3 py-2 text-right text-muted">
                    {format.dateTime(row.finishedAt, { dateStyle: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-muted">{t('soloNote')}</p>
    </main>
  );
}
