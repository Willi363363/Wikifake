// The profile — step E.5.
//
// What a player has done, from `player_stats`, which E.4 maintains as rounds
// end. **Nothing here computes anything from a game.** The screen reads one row
// and formats it; the arithmetic that is not stored — abandoned, average,
// accuracy — is `selectPlayerStats`' on the way out, so a number shown here and
// the same number in track I's admin panel come from one place.
//
// A **server** component. The stats are one query against a row keyed by the
// session's own user id, and rendering them on the server means no endpoint
// exists whose job is to hand a player's history to a browser — one fewer
// surface to get an authorisation check wrong on.
//
// The email is here and nowhere else. `05-accounts.md`'s promise is that it
// never appears in a room, a leaderboard or a shared score; a player's own
// profile is none of those, and hiding the address somebody signs in with from
// the one screen that is theirs helps nobody.
import type { PlayerStats } from '@wikifake/db';
import { Separator } from '@wikifake/ui';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';

import { AccountData } from './account-data.js';
import { SignOutButton } from './sign-out-button.js';

export interface ProfileProps {
  readonly pseudonym: string;
  readonly email: string;
  /** Null for an account that has never joined a round. */
  readonly stats: PlayerStats | null;
}

/** One figure and what it is called. */
function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    // `shadow-md` because a tile is a card, and a card in this direction casts
    // the hard offset. Found by looking at the screen: six bordered boxes with
    // nothing under them read as a table, and every other card on the site sits
    // a little proud of the page.
    <div className="border-3 border-line-strong bg-surface px-4 py-3 shadow-md">
      <dt className="text-xs tracking-wide text-muted uppercase">{label}</dt>
      {/* Mono and tabular, so a column of figures lines up — the same reason the
          scoreboard of the landing uses it. */}
      <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">
        {value}
      </dd>
    </div>
  );
}

export function Profile({ pseudonym, email, stats }: ProfileProps) {
  const t = useTranslations('account.profile');
  const format = useFormatter();

  /** A figure, or a dash: a player with no rounds has no average, not a zero. */
  const shown = (value: number | null): string =>
    value === null ? '—' : format.number(value, { signDisplay: 'auto' });

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-10">
      <h1 className="text-center text-3xl text-ink">{pseudonym}</h1>
      <p className="mt-2 text-center text-sm text-muted">
        {/* Said where it is relevant rather than in a policy nobody opens. */}
        {t('emailPrivate', { email })}
      </p>

      {stats === null ? (
        <div className="mt-8 border-3 border-line-strong bg-surface p-6 text-center shadow-md">
          <p className="text-base text-ink">{t('empty')}</p>
          <p className="mt-4">
            <Link href="/play" className="text-ink underline">
              {t('playFirst')}
            </Link>
          </p>
        </div>
      ) : (
        <>
          <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label={t('gamesFinished')} value={shown(stats.gamesFinished)} />
            <Stat label={t('gamesAbandoned')} value={shown(stats.gamesAbandoned)} />
            <Stat
              label={t('accuracy')}
              value={
                stats.accuracy === null
                  ? '—'
                  : format.number(stats.accuracy, { style: 'percent' })
              }
            />
            <Stat label={t('bestScore')} value={shown(stats.bestScore)} />
            <Stat label={t('averageScore')} value={shown(stats.averageScore)} />
            <Stat label={t('bestStreak')} value={shown(stats.bestStreak)} />
          </dl>

          <p className="mt-4 text-center text-sm text-muted">
            {/* The three the tiles above summarise, spelled out — a player who
                wants to know how many they missed should not have to subtract. */}
            {t('breakdown', {
              found: stats.falsificationsFound,
              missed: stats.falsificationsMissed,
              wrong: stats.paragraphsWronglyMarked,
            })}
          </p>

          {stats.currentStreak === 0 ? null : (
            <p className="mt-3 text-center">
              <span className="inline-block border-3 border-line-strong bg-accent px-3 py-1 text-sm font-semibold text-on-fill">
                {/* A fill carries `on-fill`, never `ink`: the one hard colour
                    rule of `01-art-direction.md`. */}
                {t('onAStreak', { count: stats.currentStreak })}
              </span>
            </p>
          )}

          <p className="mt-4 text-center text-xs text-muted">
            {t('since', {
              date: format.dateTime(stats.firstSeen, { dateStyle: 'long' }),
            })}
          </p>
        </>
      )}

      {/* Step E.7 — the two rights, on the one screen that is theirs. A
          settings page for two controls would be a screen nobody visits and a
          right nobody knows they have. */}
      <AccountData pseudonym={pseudonym} />

      <Separator className="my-8" />

      <div className="flex flex-col items-center gap-3">
        <Link href="/play" className="text-ink underline">
          {t('play')}
        </Link>
        {/* F.7 — a screen nothing points at is a screen nobody opens, which is
            the argument E.5 made for this profile itself. Here rather than on
            the entry screen: quests belong to an account, and this is the one
            account-only screen every signed-in player already reaches. */}
        <Link href="/quests" className="text-ink underline">
          {t('quests')}
        </Link>
        <SignOutButton />
      </div>
    </main>
  );
}
