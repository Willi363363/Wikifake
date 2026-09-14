// The home — step L.6, the arrangement the owner chose.
//
// **A dense dashboard, and *Play* the largest tile in it.** Four rounds of
// candidates were refused before this one, and the reason is recorded in
// `13-ui-overhaul.md`: every one of them was a centred headline, a sentence, a
// button and three numbered columns, re-skinned. That skeleton is the cliché.
// What broke the deadlock was showing the game's own figures instead of
// marketing about them.
//
// **Both audiences live in one grid.** A returning player sees their streak,
// their daily quest, what they have played and where they stand; a first visitor
// sees the top of the board and the two sentences that say what the game is. The
// tiles change contents, never places — a dashboard that draws zeroes says the
// game is empty, and a visitor who is shown an empty dashboard has been told the
// wrong thing about the product.
//
// Nothing here reads the database. `readHome` — `home.ts`, beside this file —
// did, once, on the route.
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';

import { LobbyEntry } from './entry.js';
import type { HomeView } from './home.js';

export interface DashboardProps {
  readonly home: HomeView;
  /** Whether the browser carries a real account, as opposed to a guest. */
  readonly signedIn: boolean;
  /** The name this player is shown under in a room — step E.3.3. */
  readonly pseudonym?: string;
}

/** A tile. One surface, one corner, said in one place. */
const TILE = 'flex flex-col rounded-xl bg-surface p-5';

/** A figure and what it is called. */
function Figure({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className={TILE}>
      <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
        {label}
      </span>
      <p className="m-0 mt-1 font-mono text-3xl leading-none font-bold tabular-nums text-ink">
        {value}
      </p>
    </div>
  );
}

export function Dashboard({ home, signedIn, pseudonym }: DashboardProps) {
  const t = useTranslations('lobby.home');
  const quests = useTranslations('quests');
  const format = useFormatter();
  const { stats, daily, board, recent } = home;

  /** A figure, or a dash: no rounds means no average, not an average of nought. */
  const shown = (value: number | null): string =>
    value === null ? '—' : format.number(value);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="sr-only">{t('title')}</h1>

      <div className="grid gap-4 sm:grid-cols-4">
        <LobbyEntry {...(pseudonym === undefined ? {} : { pseudonym })} />

        {/* Second cell, top row: the thing with a deadline for a player, and
            what the game is for somebody who has just arrived. */}
        {daily === null ? (
          <div className={`${TILE} sm:col-span-2`}>
            <p className="m-0 text-sm leading-relaxed text-ink-2">{t('what')}</p>
          </div>
        ) : (
          <div className={`${TILE} sm:col-span-2`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
                {quests('daily')}
              </span>
              <span className="text-xs text-ink-2">
                {quests('reward', { count: daily.reward })}
              </span>
            </div>
            <p className="m-0 mt-2 text-sm text-ink">
              {quests(`rules.${daily.ruleId}`, { target: daily.target })}
            </p>
            <p className="m-0 mt-1 font-mono text-xs tabular-nums text-muted">
              {quests('progress', {
                progress: Math.min(daily.progress, daily.target),
                target: daily.target,
              })}
            </p>
            <p className="m-0 mt-auto pt-3 text-sm">
              <Link href="/quests" className="text-accent underline">
                {t('allQuests')}
              </Link>
            </p>
          </div>
        )}

        {/* Two figures, or the two sentences that stand in for them. A guest has
            no streak, and a tile saying `0` would be a score rather than an
            absence. */}
        {stats === null ? (
          <>
            <div className={TILE}>
              <p className="m-0 text-sm leading-relaxed text-ink-2">{t('how')}</p>
            </div>
            <div className={TILE}>
              <p className="m-0 text-sm leading-relaxed text-ink-2">{t('free')}</p>
            </div>
          </>
        ) : (
          <>
            <Figure label={t('finished')} value={shown(stats.gamesFinished)} />
            <Figure label={t('average')} value={shown(stats.averageScore)} />
          </>
        )}

        {/* The board, top five. Read for a guest too: a first visitor seeing
            real names is the whole argument for a dashboard over a pitch. */}
        <section className={`${TILE} sm:col-span-2`}>
          <h2 className="m-0 font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
            {t('board')}
          </h2>
          {board.length === 0 ? (
            <p className="m-0 mt-2 text-sm text-ink-2">{t('boardEmpty')}</p>
          ) : (
            <ol className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
              {board.map((row, at) => (
                <li
                  key={row.displayName}
                  className="flex items-baseline gap-3 text-sm text-ink"
                >
                  <span className="w-5 font-mono tabular-nums text-muted">{at + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{row.displayName}</span>
                  <span className="font-mono tabular-nums text-muted">
                    {format.number(row.score)}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="m-0 mt-auto pt-3 text-sm">
            <Link href="/leaderboard" className="text-accent underline">
              {t('allBoards')}
            </Link>
          </p>
        </section>

        {/* What you played, or what an account is for. The second is the one
            place this screen asks a guest for anything. */}
        <section className={`${TILE} sm:col-span-2`}>
          <h2 className="m-0 font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
            {recent.length === 0 ? t('keepTitle') : t('lastRounds')}
          </h2>
          {recent.length === 0 ? (
            <>
              <p className="m-0 mt-2 text-sm leading-relaxed text-ink-2">
                {t('keepLead')}
              </p>
              <p className="m-0 mt-auto pt-3 text-sm">
                <Link
                  href={signedIn ? '/profile' : '/sign-up'}
                  className="text-accent underline"
                >
                  {signedIn ? t('profile') : t('keepCta')}
                </Link>
              </p>
            </>
          ) : (
            <>
              <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
                {recent.map((round) => (
                  <li
                    key={round.gameId}
                    className="flex items-baseline gap-3 text-sm text-ink"
                  >
                    {/* The topic is a fr.wikipedia.org subject — data, not
                        interface copy — so it keeps its own language. */}
                    <span lang="fr" className="min-w-0 flex-1 truncate">
                      {round.topic}
                    </span>
                    <span className="font-mono tabular-nums">
                      {round.score === null ? '—' : format.number(round.score)}
                    </span>
                    <span className="w-20 text-right text-[11px] text-muted">
                      {format.dateTime(round.endedAt, { dateStyle: 'short' })}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="m-0 mt-auto pt-3 text-sm">
                <Link href="/profile" className="text-accent underline">
                  {t('profile')}
                </Link>
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
