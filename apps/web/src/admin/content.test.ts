// Which articles are drawn, and what generation costs — step I.7, against a
// real Postgres.
//
// The cache hit rate is the figure that explains I.6: a cached round costs
// nothing to generate, so the rate is what stands between a hundred rounds and
// a hundred generations. Most of these cases are about counting it, and the
// topics beside it, without the two quietly meaning different populations.
import { game, llmCall } from '@wikifake/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { readContent, TOP_TOPICS } from './content.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();

describe.skipIf(url === null)('I.7 — content and cache', () => {
  let store: TestDatabase;

  beforeAll(async () => {
    store = await openWebTestDatabase();
  });

  beforeEach(async () => {
    await store.truncate();
  });

  afterAll(async () => {
    await store.close();
  });

  async function round(topic: string, over: { cached?: boolean } = {}): Promise<void> {
    await store.db.insert(game).values({
      mode: 'solo',
      topic,
      sourceUrl: `https://fr.wikipedia.org/wiki/${topic}`,
      paragraphs: ['un'],
      totalFakes: 1,
      timeLimit: 300,
      fromCache: over.cached ?? false,
    });
  }

  async function call(
    kind: 'topic_choice' | 'falsification' | 'flag_verification',
    failed: boolean,
  ): Promise<void> {
    await store.db.insert(llmCall).values({
      model: 'a-model',
      kind,
      inputTokens: 100,
      outputTokens: 50,
      promptChars: 10,
      outputChars: 5,
      failed,
    });
  }

  const read = () => readContent({ db: store.db });

  it('answers nothing rather than zero when nothing has been played', async () => {
    const view = await read();

    expect(view.cacheHitRate).toBeNull();
    expect(view.falsificationFailureRate).toBeNull();
    expect(view.topicFailureRate).toBeNull();
    expect(view.topics).toEqual([]);
  });

  it('counts the cache hit rate over every round played', async () => {
    await round('Chat', { cached: true });
    await round('Chat', { cached: true });
    await round('Chien', { cached: false });
    await round('Loup', { cached: false });

    const view = await read();

    expect(view.games).toBe(4);
    expect(view.fromCache).toBe(2);
    expect(view.generated).toBe(2);
    expect(view.cacheHitRate).toBe(0.5);
  });

  it('shows each topic with how often it came from the cache', async () => {
    // The two columns together are the point: forty plays and thirty-nine
    // cache hits is the cache working; forty and two is a cache that is not
    // holding what people ask for, and the totals alone cannot tell them apart.
    await round('Chat', { cached: false });
    await round('Chat', { cached: true });
    await round('Chat', { cached: true });
    await round('Chien', { cached: false });

    const view = await read();

    expect(view.topics).toEqual([
      { topic: 'Chat', games: 3, fromCache: 2 },
      { topic: 'Chien', games: 1, fromCache: 0 },
    ]);
  });

  it('breaks a tie by topic, so two reads return the same list', async () => {
    await round('Chien');
    await round('Chat');
    await round('Bœuf');

    expect((await read()).topics.map((topic) => topic.topic)).toEqual([
      'Bœuf',
      'Chat',
      'Chien',
    ]);
  });

  it('counts distinct articles beside a list that is only a sample', async () => {
    for (let at = 0; at < TOP_TOPICS + 5; at += 1) {
      await round(`Article ${String(at).padStart(2, '0')}`);
    }

    const view = await read();

    expect(view.topics).toHaveLength(TOP_TOPICS);
    // What says how much the list is missing.
    expect(view.distinctTopics).toBe(TOP_TOPICS + 5);
  });

  it('keeps the two kinds of failure apart, because they differ', async () => {
    // A topic choice that finds nothing is somebody typing a word Wikipedia
    // has no article for — ordinary. A falsification that fails is a round the
    // player waited for and did not get.
    await call('topic_choice', true);
    await call('topic_choice', false);
    await call('topic_choice', false);
    await call('topic_choice', false);
    await call('falsification', true);
    await call('falsification', false);

    const view = await read();

    expect(view.failures.topicCalls).toBe(4);
    expect(view.failures.topicFailed).toBe(1);
    expect(view.topicFailureRate).toBe(0.25);
    expect(view.failures.falsificationCalls).toBe(2);
    expect(view.falsificationFailureRate).toBe(0.5);
  });

  it('leaves flag verification out, which is not on the path to a round', async () => {
    // I.6's by-kind table already shows it, and counting it here would make a
    // report about a player's flag look like a generation failure.
    await call('flag_verification', true);
    await call('falsification', false);

    const view = await read();

    expect(view.failures.falsificationCalls).toBe(1);
    expect(view.falsificationFailureRate).toBe(0);
  });

  it('counts a generated round even when its call failed first', async () => {
    // A retry that succeeded is one game and two calls, and both figures are
    // true: the round exists, and the model was asked twice.
    await round('Chat', { cached: false });
    await call('falsification', true);
    await call('falsification', false);

    const view = await read();

    expect(view.generated).toBe(1);
    expect(view.failures.falsificationCalls).toBe(2);
    expect(view.falsificationFailureRate).toBe(0.5);
  });

  it('never reports more cached rounds than rounds', async () => {
    // The property that makes the rate a rate, and how a join that multiplied
    // rows would first show up.
    await round('Chat', { cached: true });
    await round('Chien', { cached: false });

    const view = await read();

    expect(view.fromCache).toBeLessThanOrEqual(view.games);
    expect(view.generated + view.fromCache).toBe(view.games);
    for (const topic of view.topics) {
      expect(topic.fromCache).toBeLessThanOrEqual(topic.games);
    }
  });
});
