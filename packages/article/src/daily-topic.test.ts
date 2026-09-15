// Choosing the day's subject — step N.2.
//
// The transport is injected, so no test touches the network and every case can
// read the URL that was actually built. Two things are worth proving that way
// and nothing else is: that a candidate too thin to play is **rejected before a
// model sees it**, and that the fallback to random really runs.
import { describe, expect, it } from 'vitest';

import { chooseDailyArticle } from './daily-topic.js';
import type { WikiRequest } from './mediawiki.js';
import { HTML } from './testing/round.js';

const FR: WikiRequest = { language: 'fr', userAgent: 'WikiFake/2.0 (test)' };

/** An article too thin to play: one paragraph where three are needed. */
const STUB = '<div id="bodyContent"><p>Un village de trente habitants.</p></div>';

const page = (title: string, html: string) => ({
  parse: { title, revid: 1, text: html },
});

/** Answers in order, then repeats the last — and records where it was asked. */
function transport(answers: readonly unknown[]) {
  const urls: string[] = [];
  let at = 0;

  const fetch: typeof globalThis.fetch = (input) => {
    urls.push(String(input));
    const body = answers[Math.min(at, answers.length - 1)];
    at += 1;
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  };

  return { transport: { fetch }, urls };
}

const viewed = (...titles: string[]) => ({
  query: { mostviewed: titles.map((title) => ({ ns: 0, title })) },
});
const random = (...titles: string[]) => ({
  query: { random: titles.map((title) => ({ ns: 0, title })) },
});

describe('N.2 — the day’s subject', () => {
  it('takes the most read article that can be played', async () => {
    const { transport: fetcher, urls } = transport([viewed('Chat'), page('Chat', HTML)]);

    const chosen = await chooseDailyArticle(
      { wiki: FR, transport: fetcher },
      { candidates: 20, attempts: 5 },
    );

    expect(chosen.ok).toBe(true);
    expect(chosen.ok && chosen.value.page.title).toBe('Chat');
    expect(chosen.ok && chosen.value.source).toBe('most_viewed');
    expect(urls[0]).toContain('list=mostviewed');
  });

  /*
   * The filter that is the whole of the step. A stub costs one Wikipedia request
   * to reject, and nothing is sent to a model — which is what makes asking for
   * twenty candidates affordable.
   */
  it('skips an article too thin to be worth playing', async () => {
    const { transport: fetcher } = transport([
      viewed('Vievy-le-Rayé', 'Chat'),
      page('Vievy-le-Rayé', STUB),
      page('Chat', HTML),
    ]);

    const chosen = await chooseDailyArticle(
      { wiki: FR, transport: fetcher },
      { candidates: 20, attempts: 5 },
    );

    expect(chosen.ok && chosen.value.page.title).toBe('Chat');
    expect(chosen.ok && chosen.value.rejected).toBe(1);
  });

  // Most-viewed answers across namespaces: a live call returned the main page
  // and the search page among its first five, and neither can be graded.
  it('ignores a title that is not an article', async () => {
    const { transport: fetcher } = transport([
      {
        query: {
          mostviewed: [
            { ns: 4, title: 'Wikipédia:Accueil principal' },
            { ns: 0, title: 'Chat' },
          ],
        },
      },
      page('Chat', HTML),
    ]);

    const chosen = await chooseDailyArticle(
      { wiki: FR, transport: fetcher },
      { candidates: 20, attempts: 5 },
    );

    expect(chosen.ok && chosen.value.page.title).toBe('Chat');
    expect(chosen.ok && chosen.value.rejected).toBe(0);
  });

  it('falls back to a random article when nothing was read', async () => {
    const { transport: fetcher, urls } = transport([
      { query: { mostviewed: [] } },
      random('Chat'),
      page('Chat', HTML),
    ]);

    const chosen = await chooseDailyArticle(
      { wiki: FR, transport: fetcher },
      { candidates: 20, attempts: 5 },
    );

    expect(chosen.ok && chosen.value.source).toBe('random');
    expect(urls[1]).toContain('list=random');
    expect(urls[1]).toContain('rnnamespace=0');
  });

  it('falls back when every most-read candidate is too thin', async () => {
    const { transport: fetcher } = transport([
      viewed('Stub'),
      page('Stub', STUB),
      random('Chat'),
      page('Chat', HTML),
    ]);

    const chosen = await chooseDailyArticle(
      { wiki: FR, transport: fetcher },
      { candidates: 20, attempts: 5 },
    );

    expect(chosen.ok && chosen.value.source).toBe('random');
  });

  /*
   * `attempts` bounds the requests, not the list. Without it a bad day fetches
   * every candidate at the moment somebody is waiting for a round.
   */
  it('stops fetching candidates once its attempts are spent', async () => {
    const { transport: fetcher, urls } = transport([
      viewed('A', 'B', 'C', 'D'),
      page('A', STUB),
      page('B', STUB),
      { query: { random: [] } },
    ]);

    const chosen = await chooseDailyArticle(
      { wiki: FR, transport: fetcher },
      { candidates: 20, attempts: 2 },
    );

    expect(chosen.ok).toBe(false);
    // One list call, two candidates, then the fallback list. Not four candidates.
    expect(urls.filter((url) => url.includes('action=parse'))).toHaveLength(2);
  });

  it('says so when nothing anywhere can be played', async () => {
    const { transport: fetcher } = transport([
      { query: { mostviewed: [] } },
      { query: { random: [] } },
    ]);

    const chosen = await chooseDailyArticle(
      { wiki: FR, transport: fetcher },
      { candidates: 20, attempts: 5 },
    );

    expect(chosen.ok).toBe(false);
  });
});
