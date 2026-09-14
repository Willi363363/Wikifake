// Who is playing — step K.4, the digest the owner chose.
//
// Four figures, then the list. The two layouts it was chosen over — two halves,
// and the roster taking the whole page — are gone with the question they
// answered.
//
// **The page carries two questions that are not the same question**: *how many
// are there* and *who are they*. The tiles answer the first, the list answers
// the second, and the list is the only thing on this page Overview does not
// already show — which is why it gets the whole width below rather than half.
//
// **The lab's fifth shape is deliberately absent.** Its right-hand card drew new
// accounts per day, and no reader answers that: `readPlayers` counts a cohort,
// it does not bucket it. The track's rule for a page step is exact about this —
// a field that does not map is a field to drop, not a query to invent — so the
// chart is gone rather than the panel growing a query nobody asked for.
//
// **The names are pseudonyms.** E.3.3's promise holds on this screen as on
// every other: the email appears in no room, no leaderboard, no shared score —
// and no admin panel either. Nothing here needs it, so there is no field for it.
import { useFormatter, useTranslations } from 'next-intl';

import { shareOf } from './activation.js';
import { CARD, Count, LABEL, Tile } from './parts.js';
import type { PlayersView } from './players.js';

export interface PlayersSectionProps {
  readonly players: PlayersView;
}

export function PlayersSection({ players }: PlayersSectionProps) {
  const t = useTranslations('admin.players');
  const format = useFormatter();
  const share = (part: number) =>
    format.number(shareOf(part, players.accounts) ?? 0, {
      style: 'percent',
      maximumFractionDigits: 1,
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Accounts and guests apart, because a guest is a `user` row too and a
            panel that added them together would report sign-ups that are not. */}
        <Tile
          label={t('accounts')}
          value={<Count value={players.accounts} />}
          note={t('guests', { count: players.guests })}
        />
        <Tile
          label={t('everPlayed')}
          value={<Count value={players.everPlayed} />}
          note={
            players.accounts === 0
              ? t('ofAccounts', { count: players.accounts })
              : t('shareOfAccounts', { share: share(players.everPlayed) })
          }
        />
        {/* A fixed window whatever the period says. The bar above told the
            reader once; this is the figure it was talking about. */}
        <Tile
          label={t('activeToday')}
          value={<Count value={players.activeToday} />}
          note={t('thisWeek', { count: players.activeThisWeek })}
        />
        {/* The one filled figure: *seen since* is a range on `last_seen`, the
            one dated column `player_stats` has, so this is the tile the period
            actually moves — and the one worth reading first on this page. */}
        <Tile
          label={t('activeInRange')}
          value={<Count value={players.activeInRange} />}
          note={
            players.accounts === 0
              ? t('ofAccounts', { count: players.accounts })
              : t('shareOfAccounts', { share: share(players.activeInRange) })
          }
          filled
        />
      </div>

      <section className={`${CARD} flex flex-col gap-3 p-5`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="m-0 text-lg font-bold text-ink">{t('mostActive')}</h2>
          {/* `games_finished` is a running total with no date on it, so this
              list cannot honour a period. It says so where it is, rather than
              looking ranged and being a footnote away from the truth. */}
          <p className="m-0 max-w-prose text-[11.5px] text-muted">{t('allTimeList')}</p>
        </div>

        {players.mostActive.length === 0 ? (
          <p className="m-0 text-sm text-ink-2">{t('nobody')}</p>
        ) : (
          /* A real table and not a grid of `div`s, which is what the lab drew:
             this is rows and columns with a heading for each, and the element
             that says so is the one a screen reader can navigate. The digest's
             look is styling on top of it, not a reason to lose the semantics. */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-3 border-line-strong">
                  <th scope="col" className={`${LABEL} px-2 py-2 text-left`}>
                    {t('columns.rank')}
                  </th>
                  <th scope="col" className={`${LABEL} px-2 py-2 text-left`}>
                    {t('columns.player')}
                  </th>
                  <th scope="col" className={`${LABEL} px-2 py-2 text-right`}>
                    {t('columns.finished')}
                  </th>
                  <th scope="col" className={`${LABEL} px-2 py-2 text-right`}>
                    {t('columns.started')}
                  </th>
                  <th scope="col" className={`${LABEL} px-2 py-2 text-right`}>
                    {t('columns.lastSeen')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {players.mostActive.map((player, at) => (
                  <tr
                    key={player.userId}
                    className="border-b-1 border-line last:border-b-0"
                  >
                    <td className="px-2 py-2.5 font-mono text-xs font-bold tabular-nums text-ink">
                      {at + 1}
                    </td>
                    <td className="px-2 py-2.5 text-[13.5px] font-medium text-ink">
                      {player.displayName}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-[13px] font-bold tabular-nums text-ink">
                      <Count value={player.gamesFinished} />
                    </td>
                    {/* Started beside finished, so the gap between them is
                        visible on the row rather than computed by the reader —
                        that gap is what the rounds page calls the abandon
                        rate. */}
                    <td className="px-2 py-2.5 text-right font-mono text-[13px] tabular-nums text-muted">
                      <Count value={player.gamesPlayed} />
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-xs text-muted">
                      {format.dateTime(player.lastSeen, { dateStyle: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
