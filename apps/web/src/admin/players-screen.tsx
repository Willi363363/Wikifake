// The players section — step I.3.
//
// Five figures and a short list. The figures are laid out in pairs on purpose:
// **a number on its own teaches nothing**, which is the track's own complaint
// about vanity metrics — accounts created goes up and means nothing. Beside
// *ever played* it means something, and that pairing is the whole layout.
//
// The names are pseudonyms. E.3.3's promise holds on this screen as on every
// other: the email appears in no room, no leaderboard, no shared score — and no
// admin panel either. Nothing here needs it, so there is no field for it.
import { useFormatter, useTranslations } from 'next-intl';

import type { PlayersView } from './players.js';

export interface PlayersSectionProps {
  readonly players: PlayersView;
}

function Figure({
  label,
  value,
  beside,
}: {
  readonly label: string;
  readonly value: string;
  readonly beside?: string;
}) {
  return (
    <div className="border-3 border-line-strong bg-surface px-3 py-2 shadow-md">
      <p className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl tabular-nums text-ink">{value}</p>
      {beside === undefined ? null : <p className="mt-1 text-xs text-muted">{beside}</p>}
    </div>
  );
}

export function PlayersSection({ players }: PlayersSectionProps) {
  const t = useTranslations('admin.players');
  const format = useFormatter();
  const n = (value: number) => format.number(value);

  return (
    <section aria-labelledby="admin-players" className="mt-8">
      <h2
        id="admin-players"
        className="font-mono text-xs tracking-[0.12em] text-muted uppercase"
      >
        {t('title')}
      </h2>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {/* Accounts and guests apart, because a guest is a `user` row too and a
            panel that added them together would report sign-ups that are not. */}
        <Figure
          label={t('accounts')}
          value={n(players.accounts)}
          beside={t('guests', { count: players.guests })}
        />
        <Figure
          label={t('everPlayed')}
          value={n(players.everPlayed)}
          beside={t('ofAccounts', { count: players.accounts })}
        />
        <Figure label={t('activeToday')} value={n(players.activeToday)} />
        <Figure label={t('activeThisWeek')} value={n(players.activeThisWeek)} />
      </div>

      <h3 className="mt-6 font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
        {t('mostActive')}
      </h3>

      {players.mostActive.length === 0 ? (
        <p className="mt-2 text-sm text-ink-2">{t('nobody')}</p>
      ) : (
        <div className="mt-2 overflow-x-auto border-3 border-line-strong bg-surface shadow-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-3 border-line-strong">
                <th scope="col" className="px-3 py-2 text-left text-muted">
                  {t('columns.player')}
                </th>
                <th scope="col" className="px-3 py-2 text-right text-muted">
                  {t('columns.finished')}
                </th>
                <th scope="col" className="px-3 py-2 text-right text-muted">
                  {t('columns.started')}
                </th>
                <th scope="col" className="px-3 py-2 text-right text-muted">
                  {t('columns.lastSeen')}
                </th>
              </tr>
            </thead>
            <tbody>
              {players.mostActive.map((player) => (
                <tr key={player.userId}>
                  <td className="px-3 py-2 text-ink">{player.displayName}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                    {n(player.gamesFinished)}
                  </td>
                  {/* Started beside finished, so the gap between them is
                      visible on the row rather than computed by the reader —
                      that gap is what I.5 will call the abandon rate. */}
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-muted">
                    {n(player.gamesPlayed)}
                  </td>
                  <td className="px-3 py-2 text-right text-muted">
                    {format.dateTime(player.lastSeen, { dateStyle: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
