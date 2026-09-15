// The profile — step E.5, rearranged into P2 at L.6.
//
// **P2 — one figure leads.** It was six equal tiles in a grid, which is a table
// with borders: every number the same size, so none of them said anything. The
// average score is the only one that says whether somebody is *getting better* —
// rounds played only says they kept playing — so it is the panel, at the size
// the rest of them add up to.
//
// Nothing on the accent panel is faded. `opacity-90` on a secondary line is the
// composite `CONTRAST_PAIRS` cannot measure, and the reason the disabled button
// stopped doing it; a smaller size and `ink-2`'s job done by the type scale says
// the same thing with two colours the audit knows.
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
import { Badges } from './badges.js';
import { SignOutButton } from './sign-out-button.js';

export interface ProfileProps {
  readonly pseudonym: string;
  readonly email: string;
  /** Null for an account that has never joined a round. */
  readonly stats: PlayerStats | null;
}

/** One of the four supporting figures, and what it is called. */
function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-xl bg-surface px-4 py-3">
      <dt className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
        {label}
      </dt>
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
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:px-8">
      {stats === null ? (
        <>
          <h1 className="m-0 text-3xl text-ink">{pseudonym}</h1>
          <div className="rounded-xl bg-surface p-6">
            <p className="m-0 text-base text-ink">{t('empty')}</p>
            <p className="m-0 mt-4">
              <Link href="/play" className="text-accent underline">
                {t('playFirst')}
              </Link>
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            {/* The lead. The pseudonym is its first line rather than a heading
                above the whole page: the panel is who you are and how you are
                doing, and splitting those put the name on one screen and the
                answer on another. */}
            <section className="flex flex-col justify-between gap-6 rounded-xl bg-accent p-6 text-on-fill">
              <h1 className="m-0 text-[15px] font-semibold">{pseudonym}</h1>
              <div>
                <p className="m-0 font-mono text-6xl leading-none font-bold tabular-nums">
                  {shown(stats.averageScore)}
                </p>
                <p className="m-0 mt-2 text-sm">{t('averageScore')}</p>
              </div>
              <div className="flex flex-col gap-1 text-xs">
                {stats.currentStreak === 0 ? null : (
                  <span className="font-semibold">
                    {t('onAStreak', { count: stats.currentStreak })}
                  </span>
                )}
                <span>
                  {t('since', {
                    date: format.dateTime(stats.firstSeen, { dateStyle: 'long' }),
                  })}
                </span>
              </div>
            </section>

            <dl className="m-0 grid grid-cols-2 gap-4">
              <Stat label={t('gamesFinished')} value={shown(stats.gamesFinished)} />
              <Stat label={t('bestScore')} value={shown(stats.bestScore)} />
              <Stat label={t('bestStreak')} value={shown(stats.bestStreak)} />
              <Stat label={t('gamesAbandoned')} value={shown(stats.gamesAbandoned)} />
            </dl>
          </div>

          {/* Accuracy and its arithmetic, together. The figure was a seventh
              tile saying a percentage and the sentence was a caption under the
              grid, and a player who wanted to know how many they missed had to
              read one and subtract from the other. */}
          <section className="flex flex-col gap-2 rounded-xl bg-surface p-5">
            <h2 className="m-0 flex flex-wrap items-baseline gap-x-3 text-base text-ink">
              <span className="font-mono text-2xl font-semibold tabular-nums">
                {stats.accuracy === null
                  ? '—'
                  : format.number(stats.accuracy, { style: 'percent' })}
              </span>
              <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
                {t('accuracy')}
              </span>
            </h2>
            <p className="m-0 max-w-prose text-sm text-ink-2">
              {t('breakdown', {
                found: stats.falsificationsFound,
                missed: stats.falsificationsMissed,
                wrong: stats.paragraphsWronglyMarked,
              })}
            </p>
          </section>

          {/* M.2 — after the figures rather than among them. A badge is what a
              counter adds up to, so it reads as a conclusion; above the grid it
              would have been an ornament over the numbers it summarises. */}
          <Badges stats={stats} />
        </>
      )}

      {/* Said where it is relevant rather than in a policy nobody opens. */}
      <p className="m-0 text-xs text-muted">{t('emailPrivate', { email })}</p>

      {/* Step E.7 — the two rights, on the one screen that is theirs. A
          settings page for two controls would be a screen nobody visits and a
          right nobody knows they have. */}
      <AccountData pseudonym={pseudonym} />

      <Separator className="my-2" />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link href="/play" className="text-accent underline">
          {t('play')}
        </Link>
        {/* F.7 — a screen nothing points at is a screen nobody opens, which is
            the argument E.5 made for this profile itself. Here rather than on
            the entry screen: quests belong to an account, and this is the one
            account-only screen every signed-in player already reaches. */}
        <Link href="/quests" className="text-accent underline">
          {t('quests')}
        </Link>
        {/* H.7 — the same argument, one step on: a shop nothing points at is a
            shop nobody opens, and this is where a player who has just claimed a
            quest goes looking for what the coins are for. */}
        <Link href="/shop" className="text-accent underline">
          {t('shop')}
        </Link>
        <SignOutButton />
      </div>
    </main>
  );
}
