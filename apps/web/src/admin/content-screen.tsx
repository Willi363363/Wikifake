// Which articles are drawn, and what generation costs — step I.7.
//
// The cache hit rate leads, because it is what decides the section above: a
// cached game is free, so the rate is what stands between a hundred rounds and
// a hundred generations.
//
// The two failure rates are shown apart on purpose. **They fail differently**:
// a topic choice that finds nothing is somebody typing a word Wikipedia has no
// article for — ordinary — while a falsification that fails is a round a player
// waited for and did not get.
import { useFormatter, useTranslations } from 'next-intl';

import type { ContentView } from './content.js';

export interface ContentSectionProps {
  readonly content: ContentView;
}

function Percent({ share }: { readonly share: number | null }) {
  const format = useFormatter();
  const t = useTranslations('admin.content');

  return (
    <>
      {share === null
        ? t('nothing')
        : format.number(share, { style: 'percent', maximumFractionDigits: 1 })}
    </>
  );
}

export function ContentSection({ content }: ContentSectionProps) {
  const t = useTranslations('admin.content');
  const format = useFormatter();
  const n = (value: number) => format.number(value);

  return (
    <section aria-labelledby="admin-content" className="mt-8">
      <h2
        id="admin-content"
        className="font-mono text-xs tracking-[0.12em] text-muted uppercase"
      >
        {t('title')}
      </h2>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="border-3 border-line-strong bg-surface px-3 py-3 shadow-md">
          <p className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
            {t('cacheHitRate')}
          </p>
          <p className="mt-1 font-mono text-3xl tabular-nums text-ink">
            <Percent share={content.cacheHitRate} />
          </p>
          <p className="mt-1 text-xs text-muted">{t('cacheWhy')}</p>
        </div>
        <div className="border-3 border-line-strong bg-surface px-3 py-2 shadow-md">
          <p className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
            {t('generated')}
          </p>
          <p className="mt-1 font-mono text-2xl tabular-nums text-ink">
            {n(content.generated)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {t('ofGames', { count: content.games })}
          </p>
        </div>
        <div className="border-3 border-line-strong bg-surface px-3 py-2 shadow-md">
          <p className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
            {t('distinctTopics')}
          </p>
          <p className="mt-1 font-mono text-2xl tabular-nums text-ink">
            {n(content.distinctTopics)}
          </p>
        </div>
        <div className="border-3 border-line-strong bg-surface px-3 py-2 shadow-md">
          <p className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
            {t('failedGeneration')}
          </p>
          <p className="mt-1 font-mono text-2xl tabular-nums text-ink">
            <Percent share={content.falsificationFailureRate} />
          </p>
          <p className="mt-1 text-xs text-muted">
            {t('ofCalls', { count: content.failures.falsificationCalls })}
          </p>
        </div>
      </div>

      {/* Apart from the figure above, and said rather than left to be guessed:
          a topic nobody can find is not a fault. */}
      <p className="mt-2 text-xs text-muted">
        {t('topicFailures', {
          count: content.failures.topicFailed,
          calls: content.failures.topicCalls,
        })}
      </p>

      <h3 className="mt-6 font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
        {t('topTopics')}
      </h3>

      {content.topics.length === 0 ? (
        <p className="mt-2 text-sm text-ink-2">{t('noTopics')}</p>
      ) : (
        <div className="mt-2 overflow-x-auto border-3 border-line-strong bg-surface shadow-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-3 border-line-strong">
                <th scope="col" className="px-3 py-2 text-left text-muted">
                  {t('columns.topic')}
                </th>
                <th scope="col" className="px-3 py-2 text-right text-muted">
                  {t('columns.games')}
                </th>
                {/* The two together are the point: forty plays and thirty-nine
                    cache hits is the cache working; forty and two is not. */}
                <th scope="col" className="px-3 py-2 text-right text-muted">
                  {t('columns.cached')}
                </th>
              </tr>
            </thead>
            <tbody>
              {content.topics.map((topic) => (
                <tr key={topic.topic}>
                  <td className="px-3 py-2 text-ink" lang="fr">
                    {topic.topic}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                    {n(topic.games)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-muted">
                    {n(topic.fromCache)}
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
