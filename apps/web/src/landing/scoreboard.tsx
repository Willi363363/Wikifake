// Beat 4 of the landing: what a mark is worth.
//
// The numbers are `@wikifake/domain`'s, imported rather than typed out. C2 is
// the scoring scale and it has one source of truth; a landing page that
// advertised 150 while the server paid 120 would be a lie with a test suite
// green behind it. The catalogue holds the labels — prose — and nothing else.
//
// Formatted through `Intl.NumberFormat` with the interface locale, so the time
// bonus reads `+0.5` in English and `+0,5` in French. `signDisplay` is what
// puts the `+` on a gain and the locale's own minus sign on a cost, rather
// than a `+` glued on in JSX that no translation could move.
import {
  PER_FALSE_POSITIVE,
  PER_TRUE_POSITIVE,
  TIME_BONUS_PER_SECOND,
} from '@wikifake/domain';
import { useLocale, useTranslations } from 'next-intl';

/**
 * The four outcomes, in the order a player meets them.
 *
 * `missed` is zero on purpose and stated rather than omitted: a paragraph read
 * straight past costs nothing, and a scoreboard that only lists what moves the
 * score leaves the player to guess at that.
 */
const OUTCOMES = [
  { key: 'found', points: PER_TRUE_POSITIVE },
  { key: 'missed', points: 0 },
  { key: 'wrong', points: -PER_FALSE_POSITIVE },
  { key: 'clock', points: TIME_BONUS_PER_SECOND },
] as const;

export function Scoreboard() {
  const t = useTranslations('home.beats.score.outcomes');
  const locale = useLocale();
  const points = new Intl.NumberFormat(locale, { signDisplay: 'exceptZero' });

  return (
    <dl className="mt-6 border-3 border-line-strong bg-surface shadow-md">
      {OUTCOMES.map(({ key, points: value }) => (
        <div
          key={key}
          className="flex items-baseline justify-between gap-4 border-b-3 border-line last:border-b-0 px-4 py-3"
        >
          <dt className="text-sm text-ink">{t(key)}</dt>
          {/* Tabular figures so the column lines up: four rows of digits that
              wander are four rows nobody reads as a scale. */}
          <dd className="font-mono text-lg font-semibold tabular-nums text-ink">
            {points.format(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
