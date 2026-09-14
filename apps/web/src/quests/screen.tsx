// The quests screen — step F.7, rearranged into Q1 at L.6.
//
// **Q1 — today on the left, the week on the right.** They were stacked, one
// section above the other, and the owner chose the two columns because the two
// lots are different promises: a day is something you finish tonight, a week is
// something you are partway through. Stacked, the weekly set is below the fold
// on a phone and reads as an afterthought of the daily one.
//
// Each lot is one panel with its quests as lines inside it, rather than four
// cards in a column. Four cards is four edges to say one thing.
//
// A **server** component holding the list, with one client component per row for
// the button. The same shape `/profile` has and for the same reason: the list is
// one read keyed by the session's own user id, so no endpoint exists whose job
// is to hand a player's quests to a browser. The only route F.7 adds is the one
// that *writes* — `POST /api/quests/claim`.
//
// **The rule carries no prose**, which F.1 decided, so every sentence here comes
// out of the catalogue keyed by the rule's identifier. `{target}` is the drawn
// number, which is why a label is a message with a placeholder rather than a
// noun a screen concatenates onto a figure.
import { Badge, Progress } from '@wikifake/ui';
import { QUEST_CATALOGUE, type QuestPeriod } from '@wikifake/domain';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { ClaimButton } from './claim-button.js';
import type { LiveQuest } from './sets.js';

export interface QuestsScreenProps {
  readonly quests: readonly LiveQuest[];
}

/** One period's worth, in the order the read path returned them. */
function QuestList({
  quests,
  period,
}: {
  readonly quests: readonly LiveQuest[];
  readonly period: QuestPeriod;
}) {
  const t = useTranslations('quests');
  const mine = quests.filter((quest) => quest.period === period);

  return (
    <section
      aria-labelledby={`quests-${period}`}
      className="flex flex-col rounded-xl bg-surface p-5"
    >
      <h2
        id={`quests-${period}`}
        className="m-0 font-mono text-xs tracking-[0.12em] text-muted uppercase"
      >
        {t(period)}
      </h2>

      {mine.length === 0 ? (
        <p className="mt-4 text-sm text-ink-2">{t('empty')}</p>
      ) : (
        <ul className="m-0 mt-4 flex list-none flex-col gap-5 p-0">
          {mine.map((quest) => (
            <QuestRow key={quest.ruleId} quest={quest} />
          ))}
        </ul>
      )}
    </section>
  );
}

function QuestRow({ quest }: { readonly quest: LiveQuest }) {
  const t = useTranslations('quests');
  const claimed = quest.claimedAt !== null;
  // Capped for the bar and for the sentence, and **not** in the reader:
  // `progressFor` returns what a player actually did, so five rounds towards a
  // quest asking three is five. A screen showing "5 of 3" would be arithmetic
  // nobody asked for, so the minimum is taken here — F.4 said this is where.
  const shown = Math.min(quest.progress, quest.target);

  return (
    // No card of its own since L.6: the panel around the lot is the surface, and
    // a card inside a card is an edge drawn to separate two things that are
    // already a list. What separates one quest from the next is the gap.
    <li>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-ink">
          {t(`rules.${quest.ruleId}`, { target: quest.target })}
        </h3>
        <Badge tone={claimed ? 'green' : 'accent'}>
          {t('reward', { count: quest.reward })}
        </Badge>
      </div>

      <p className="mt-2 font-mono text-xs tabular-nums text-muted">
        {t('progress', { progress: shown, target: quest.target })}
      </p>
      <Progress
        className="mt-2"
        value={shown}
        max={quest.target}
        aria-label={t(`rules.${quest.ruleId}`, { target: quest.target })}
      />

      <div className="mt-3">
        {claimed ? (
          // Not a disabled button: `disabled:opacity-40` is the one translucency
          // the direction forbids — `06-structural-debt.md` — and a claimed
          // quest is a statement rather than a control anyway.
          <p className="text-sm font-bold text-ink">{t('claimed')}</p>
        ) : quest.complete ? (
          <ClaimButton questId={quest.questId} />
        ) : (
          <p className="text-sm text-muted">{t('locked')}</p>
        )}
      </div>
    </li>
  );
}

export function QuestsScreen({ quests }: QuestsScreenProps) {
  const t = useTranslations('quests');
  // Every rule the catalogue knows is claimable at some reward, so the total a
  // set is worth is arithmetic over the list rather than a figure to store.
  const claimed = quests.filter((quest) => quest.claimedAt !== null);
  const earned = claimed.reduce((total, quest) => total + quest.reward, 0);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="m-0 text-3xl text-ink">{t('title')}</h1>
        <p className="m-0 max-w-prose text-sm text-muted">{t('lead')}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <QuestList quests={quests} period="daily" />
        <QuestList quests={quests} period="weekly" />
      </div>

      {/* Said plainly rather than implied by a coin count that goes nowhere.
          Track H owns the wallet, F.6 credits nothing yet, and a screen that
          showed a balance would be promising a shop that does not exist. */}
      <p className="m-0 text-sm text-muted">
        {t('reward', { count: earned })} — {t('wallet')}{' '}
        <Link href="/play" className="text-accent underline">
          {t('play')}
        </Link>
      </p>
    </main>
  );
}

/** Named here so a test and the screen agree on what a full set looks like. */
export const QUEST_RULES_KNOWN = Object.keys(QUEST_CATALOGUE).length;
