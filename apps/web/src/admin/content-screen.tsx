// Which articles are drawn, and what generation costs — step K.8, the digest.
//
// Four figures, the article list, and the two failure rates beside it. The two
// layouts it was chosen over — the two subjects as halves, and the article list
// as the whole page — are gone with the question they answered.
//
// **The cache hit rate leads**, because it decides the cost page: a cached round
// is free, so this rate is what stands between a hundred rounds and a hundred
// generations, and `generated` is the denominator the spend is divided by.
//
// **The two failure rates are kept apart on purpose. They fail differently**: a
// topic choice that finds nothing is somebody typing a word Wikipedia has no
// article for — ordinary — while a falsification that fails is a round a player
// waited for and did not get.
import { useFormatter, useTranslations } from 'next-intl';

import type { ContentView } from './content.js';
import { CARD, Count, Figure, LABEL, Percent, Tile } from './parts.js';

export interface ContentSectionProps {
  readonly content: ContentView;
}

export function ContentSection({ content }: ContentSectionProps) {
  const t = useTranslations('admin.content');
  const format = useFormatter();
  /** *N of M calls*, with M pluralised — both halves, because a rate alone
      cannot tell one failure in four from a thousand in four thousand. */
  const of = (failed: number, calls: number) =>
    t('failedOf', { failed: format.number(failed), calls });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label={t('cacheHitRate')}
          value={<Percent share={content.cacheHitRate} nothing={t('nothing')} />}
          note={t('cachedOf', {
            cached: format.number(content.fromCache),
            games: content.games,
          })}
          filled
        />
        <Tile
          label={t('generated')}
          value={<Count value={content.generated} />}
          note={t('modelWrote')}
        />
        <Tile
          label={t('distinctTopics')}
          value={<Count value={content.distinctTopics} />}
          note={
            content.topics[0] === undefined
              ? t('noTopics')
              : t('mostPlayedIs', { topic: content.topics[0].topic })
          }
        />
        <Tile
          label={t('failedGeneration')}
          value={
            <Percent share={content.falsificationFailureRate} nothing={t('nothing')} />
          }
          note={of(
            content.failures.falsificationFailed,
            content.failures.falsificationCalls,
          )}
        />
      </div>

      <p className="m-0 max-w-prose text-[12px] leading-relaxed text-ink-2">
        {t('cacheWhy')}
      </p>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className={`${CARD} flex flex-col gap-3 p-5`}>
          <h2 className="m-0 text-lg font-bold text-ink">{t('topTopics')}</h2>

          {content.topics.length === 0 ? (
            <p className="m-0 text-sm text-ink-2">{t('noTopics')}</p>
          ) : (
            /* A real table and not a grid of `div`s, which is what the lab
               drew: this is rows and columns with a heading for each, and the
               element that says so is the one a screen reader can navigate. */
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-3 border-line-strong">
                    <th scope="col" className={`${LABEL} px-2 py-2 text-left`}>
                      {t('columns.topic')}
                    </th>
                    <th scope="col" className={`${LABEL} px-2 py-2 text-right`}>
                      {t('columns.games')}
                    </th>
                    <th scope="col" className={`${LABEL} px-2 py-2 text-right`}>
                      {t('columns.cached')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {content.topics.map((topic) => (
                    <tr
                      key={topic.topic}
                      className="border-b-1 border-line last:border-b-0"
                    >
                      {/* `lang="fr"`, because the game reads fr.wikipedia.org:
                          an article's title is data and not our prose, and a
                          screen reader saying it in an English voice is what
                          this attribute prevents. */}
                      <td
                        lang="fr"
                        className="truncate px-2 py-2.5 text-[13.5px] text-ink"
                      >
                        {topic.topic}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-[13px] font-bold tabular-nums text-ink">
                        <Count value={topic.games} />
                      </td>
                      {/* A topic's plays beside its cache hits, because the
                          totals alone cannot tell a working cache from a
                          missing one. */}
                      <td className="px-2 py-2.5 text-right font-mono text-[13px] tabular-nums text-muted">
                        <Percent
                          share={topic.games === 0 ? null : topic.fromCache / topic.games}
                          nothing={t('nothing')}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={`${CARD} flex flex-col gap-4 p-5`}>
          <h2 className="m-0 text-lg font-bold text-ink">{t('whenWrong')}</h2>

          <Figure
            label={t('falsification')}
            value={
              <Percent share={content.falsificationFailureRate} nothing={t('nothing')} />
            }
            note={of(
              content.failures.falsificationFailed,
              content.failures.falsificationCalls,
            )}
          />
          <Figure
            label={t('topicEmpty')}
            value={<Percent share={content.topicFailureRate} nothing={t('nothing')} />}
            note={of(content.failures.topicFailed, content.failures.topicCalls)}
          />

          <p className="m-0 mt-auto max-w-prose border-t-3 border-line pt-3 text-[11.5px] leading-relaxed text-muted">
            {t('topicFailures', {
              count: content.failures.topicFailed,
              calls: content.failures.topicCalls,
            })}
          </p>
        </section>
      </div>
    </div>
  );
}
