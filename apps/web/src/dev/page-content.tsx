// Three Content pages, one set of figures.
//
// Content answers *what is the game made of, and how often did making it
// work*. Two subjects, and they pull apart: the cache is an economic fact —
// a round served from it costs nothing to generate — while the failure rates
// are an operational one.
//
// The trap this page sets: **a topic the model could not find is not a
// failure**. A word with no Wikipedia article behind it is a player typing
// something odd, not a broken system, and a layout that files the two together
// is a layout that raises an alarm at the wrong thing.
import { count, percent, type Sample, type Topic } from './sample-data.js';
import { CARD, Figure, LABEL, PANEL, Tile } from './parts.js';

export type ContentLayoutId = 'digest' | 'split' | 'library';

export interface ContentLayout {
  readonly id: ContentLayoutId;
  readonly name: string;
  readonly bet: string;
  readonly cost: string;
}

export const CONTENT_LAYOUTS: readonly ContentLayout[] = [
  {
    id: 'digest',
    name: 'C1 — digest',
    bet: 'The shape the panel now has: four figures, the article list, and the two failure rates beside it.',
    cost: 'The cache rate and the failure rates end up as neighbours, and they are not the same kind of fact at all.',
  },
  {
    id: 'split',
    name: 'C2 — cache and failures',
    bet: 'Two panels for two subjects: what generation cost was avoided, and what generation got wrong. The article list follows as evidence.',
    cost: 'It splits a small page in two, and neither half is big enough to need a heading of its own.',
  },
  {
    id: 'library',
    name: 'C3 — the library',
    bet: 'The articles are the page. Every row shows how much of it came from the cache, so the list carries the cache rate instead of a tile repeating it.',
    cost: 'Eight rows is a sample, not a census — a list that looks complete and is not is worse than a number.',
  },
];

/** The distinction this page exists to protect. */
function NotAFailure() {
  return (
    <p className="m-0 text-[11.5px] leading-relaxed text-muted">
      A topic that came back empty is{' '}
      <strong className="text-ink-2">not a failure</strong>: a word Wikipedia has no
      article for is somebody typing something odd, not a broken system. The falsification
      rate is the one worth an alarm.
    </p>
  );
}

function Articles({
  topics,
  bars = false,
}: {
  readonly topics: readonly Topic[];
  readonly bars?: boolean;
}) {
  const top = topics[0]?.games ?? 1;
  const columns = 'grid grid-cols-[minmax(0,1fr)_4.5rem_5.5rem] items-center gap-3';
  return (
    <div className="flex flex-col">
      <div className={`${columns} border-b-3 border-line-strong pb-2`}>
        <span className={LABEL}>Article</span>
        <span className={`${LABEL} text-right`}>Rounds</span>
        <span className={`${LABEL} text-right`}>From cache</span>
      </div>
      {topics.map((topic) => (
        <div
          key={topic.topic}
          className={`${columns} border-b-1 border-line py-2.5 last:border-b-0`}
        >
          <span className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-[13.5px] text-ink">{topic.topic}</span>
            {bars ? (
              <span className="flex h-1.5 w-full border-1 border-line">
                <span
                  className="h-full bg-green"
                  style={{
                    width: `${String(Math.round((topic.fromCache / top) * 100))}%`,
                  }}
                />
                <span
                  className="h-full bg-accent"
                  style={{
                    width: `${String(Math.round(((topic.games - topic.fromCache) / top) * 100))}%`,
                  }}
                />
              </span>
            ) : null}
          </span>
          <span className="text-right font-mono text-[13px] font-bold text-ink">
            {count(topic.games)}
          </span>
          <span className="text-right font-mono text-[13px] text-muted">
            {percent(topic.fromCache / topic.games)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** C1 — the house shape. */
export function ContentDigest({ data }: { readonly data: Sample }) {
  const { content } = data;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="From cache"
          value={percent(content.cacheHitRate)}
          note={`${count(content.fromCache)} of ${count(content.games)} rounds`}
          filled
        />
        <Tile
          label="Generated"
          value={count(content.generated)}
          note="rounds the model wrote"
        />
        <Tile
          label="Distinct articles"
          value={count(content.distinctTopics)}
          note={`most played: ${content.topTopic}`}
        />
        <Tile
          label="Falsification failed"
          value={percent(content.falsificationFailed / content.falsificationCalls)}
          note={`${count(content.falsificationFailed)} of ${count(content.falsificationCalls)} calls`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className={`${CARD} flex flex-col gap-3 p-5`}>
          <h2 className="m-0 text-lg font-bold text-ink">Most played</h2>
          <Articles topics={content.topics} />
        </section>

        <section className={`${CARD} flex flex-col gap-4 p-5`}>
          <h2 className="m-0 text-lg font-bold text-ink">When generation went wrong</h2>
          <Figure
            label="Falsification"
            value={percent(content.falsificationFailed / content.falsificationCalls)}
            note={`${count(content.falsificationFailed)} of ${count(content.falsificationCalls)} calls failed`}
          />
          <Figure
            label="Topic came back empty"
            value={percent(content.topicFailed / content.topicCalls)}
            note={`${count(content.topicFailed)} of ${count(content.topicCalls)} choices`}
          />
          <div className="mt-auto border-t-3 border-line pt-3">
            <NotAFailure />
          </div>
        </section>
      </div>
    </div>
  );
}

/** C2 — the two subjects, side by side. */
export function ContentSplit({ data }: { readonly data: Sample }) {
  const { content } = data;
  const saved = content.fromCache;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${CARD} flex flex-col gap-4 p-5`}>
          <h2 className="m-0 text-lg font-bold text-ink">What cost nothing to make</h2>
          <div className="flex items-end gap-4">
            <span className="text-5xl leading-none font-extrabold text-ink">
              {percent(content.cacheHitRate)}
            </span>
            <span className="pb-1 text-[13px] text-muted">served from the cache</span>
          </div>
          <div className="flex h-10 border-3 border-line-strong">
            <span
              className="flex h-full items-center bg-green px-2"
              style={{ width: `${String(Math.round(content.cacheHitRate * 100))}%` }}
            >
              <span className="truncate font-mono text-[11px] font-bold text-ink">
                {count(saved)}
              </span>
            </span>
            <span className="flex h-full flex-1 items-center bg-accent px-2">
              <span className="truncate font-mono text-[11px] font-bold text-ink">
                {count(content.generated)}
              </span>
            </span>
          </div>
          <p className="m-0 text-[12px] leading-relaxed text-muted">
            A round served from the cache costs nothing to generate. This rate is what
            separates {count(content.games)} rounds from {count(content.generated)}{' '}
            generations — and it is the denominator the cost page divides by.
          </p>
        </section>

        <section className={`${CARD} flex flex-col gap-4 p-5`}>
          <h2 className="m-0 text-lg font-bold text-ink">What went wrong</h2>
          <div className="grid grid-cols-2 gap-4">
            <Figure
              label="Falsification"
              value={percent(content.falsificationFailed / content.falsificationCalls)}
              note={`${count(content.falsificationFailed)} of ${count(content.falsificationCalls)}`}
            />
            <Figure
              label="Topic empty"
              value={percent(content.topicFailed / content.topicCalls)}
              note={`${count(content.topicFailed)} of ${count(content.topicCalls)}`}
            />
          </div>
          <div className="flex h-3 border-3 border-line-strong bg-bg">
            <span
              className="h-full bg-danger"
              style={{
                width: `${String(
                  Math.round(
                    (content.falsificationFailed / content.falsificationCalls) * 100,
                  ),
                )}%`,
              }}
            />
          </div>
          <div className="mt-auto border-t-3 border-line pt-3">
            <NotAFailure />
          </div>
        </section>
      </div>

      <section className={`${CARD} flex flex-col gap-3 p-5`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="m-0 text-lg font-bold text-ink">Most played</h2>
          <span className="font-mono text-[11px] text-muted">
            {count(content.distinctTopics)} distinct articles in the period
          </span>
        </div>
        <Articles topics={content.topics} />
      </section>
    </div>
  );
}

/** C3 — the articles are the page. */
export function ContentLibrary({ data }: { readonly data: Sample }) {
  const { content } = data;
  return (
    <div className="flex flex-col gap-4">
      <section className={`${PANEL} flex flex-wrap gap-x-10 gap-y-4 p-4`}>
        <Figure label="Distinct articles" value={count(content.distinctTopics)} />
        <Figure label="Rounds" value={count(content.games)} />
        <Figure label="Generated" value={count(content.generated)} />
        <Figure
          label="Falsification failed"
          value={percent(content.falsificationFailed / content.falsificationCalls)}
        />
      </section>

      <section className={`${CARD} flex flex-col gap-4 p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <h2 className="m-0 text-xl font-bold text-ink">The library</h2>
          <div className="flex gap-4">
            <span className="flex items-center gap-2">
              <span className="size-3 border-2 border-line-strong bg-green" />
              <span className="text-[12.5px] text-ink-2">From cache</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="size-3 border-2 border-line-strong bg-accent" />
              <span className="text-[12.5px] text-ink-2">Generated</span>
            </span>
          </div>
        </div>

        <Articles topics={content.topics} bars />

        <p className="m-0 border-t-3 border-line pt-3 text-[11.5px] leading-relaxed text-muted">
          Eight rows, and that is the whole list — a sample, not a census. There are{' '}
          {count(content.distinctTopics)} distinct articles in this period, and the rest
          are not here.
        </p>
        <NotAFailure />
      </section>
    </div>
  );
}
