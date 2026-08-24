// 3.2's criteria: two calls in two languages with no leakage, and a missing page
// as a typed value rather than an exception.
//
// The transport is injected, so no test touches the network — and, more useful
// than that, every test can read the URL that was actually built. The bug being
// prevented is a request going to the wrong Wikipedia, and the only way to check
// that is to look at where the request went.
import { describe, expect, it } from 'vitest';

import { fetchRenderedPage, searchTitles, type WikiRequest } from './mediawiki.js';

const FR: WikiRequest = { language: 'fr', userAgent: 'WikiFake/2.0 (test)' };
const EN: WikiRequest = { language: 'en', userAgent: 'WikiFake/2.0 (test)' };

/** A transport that records every call and answers with what it was given. */
function recorder(answers: readonly unknown[]) {
  const urls: string[] = [];
  const agents: (string | null)[] = [];
  let at = 0;

  // Typed by `fetch` itself, so the parameter types come from the runtime rather
  // than from a DOM lib this package does not load.
  const fetch: typeof globalThis.fetch = (input, init) => {
    urls.push(String(input));
    const headers = new Headers(init?.headers);
    agents.push(headers.get('User-Agent'));
    const body = answers[Math.min(at, answers.length - 1)];
    at += 1;
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  };

  return { transport: { fetch }, urls, agents };
}

const PAGE = {
  parse: {
    title: 'Chat',
    revid: 238196699,
    text: '<div id="bodyContent"><p>Le chat.</p></div>',
  },
};

describe('3.2 — the language does not leak between calls', () => {
  // The criterion. The Python library keeps the language in a module global, so
  // whoever set it last decides where everyone else's request goes.
  it('sends each call to the wiki it was asked for', async () => {
    const { transport, urls } = recorder([PAGE]);

    await fetchRenderedPage('Chat', FR, transport);
    await fetchRenderedPage('Cat', EN, transport);
    await fetchRenderedPage('Chocolat', FR, transport);

    expect(urls.map((url) => new URL(url).host)).toEqual([
      'fr.wikipedia.org',
      'en.wikipedia.org',
      'fr.wikipedia.org',
    ]);
  });

  it('builds the page URL in the language that was asked for', async () => {
    const { transport } = recorder([PAGE]);
    const french = await fetchRenderedPage('Chat', FR, transport);
    const english = await fetchRenderedPage('Chat', EN, transport);

    expect(french.ok && french.value.url).toBe('https://fr.wikipedia.org/wiki/Chat');
    expect(english.ok && english.value.url).toBe('https://en.wikipedia.org/wiki/Chat');
  });

  it('sends the user agent on every call, search included', async () => {
    const { transport, agents } = recorder([
      { query: { search: [{ title: 'Chat' }] } },
      PAGE,
    ]);

    await searchTitles('chat', FR, transport);
    await fetchRenderedPage('Chat', FR, transport);

    expect(agents).toEqual(['WikiFake/2.0 (test)', 'WikiFake/2.0 (test)']);
  });

  // Wikimedia's policy refuses anonymous clients, and the `wikipedia` library's
  // default agent is exactly that.
  it('refuses to call without a user agent', async () => {
    const { transport, urls } = recorder([PAGE]);
    const result = await fetchRenderedPage(
      'Chat',
      { language: 'fr', userAgent: '  ' },
      transport,
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.detail).toMatch(/user agent/i);
    // And nothing was sent: a refused request must not reach Wikipedia.
    expect(urls).toEqual([]);
  });

  // The language reaches a hostname. An unvalidated one reaches somewhere else.
  it.each([['fr.evil.example'], ['../'], [''], ['FR'], ['fr/../en']])(
    'refuses %o as a language',
    async (language) => {
      const { transport, urls } = recorder([PAGE]);
      const result = await fetchRenderedPage('Chat', { ...FR, language }, transport);
      expect(result.ok).toBe(false);
      expect(urls).toEqual([]);
    },
  );

  it.each([['fr'], ['en'], ['pt-br'], ['nds-nl']])('accepts %o', async (language) => {
    const { transport, urls } = recorder([PAGE]);
    await fetchRenderedPage('Chat', { ...FR, language }, transport);
    expect(urls).toHaveLength(1);
  });
});

describe('3.2 — a missing page is a value, not an exception', () => {
  it('reports not_found on missingtitle', async () => {
    const { transport } = recorder([
      { error: { code: 'missingtitle', info: 'no such page' } },
    ]);
    const result = await fetchRenderedPage('Sujet Inexistant 9x8', FR, transport);

    expect(result).toMatchObject({ ok: false, reason: 'not_found' });
  });

  it('tells an unreachable Wikipedia apart from a missing page', async () => {
    const fetch = (() =>
      Promise.reject(new Error('getaddrinfo ENOTFOUND'))) as typeof globalThis.fetch;
    const result = await fetchRenderedPage('Chat', FR, { fetch });

    // The distinction that matters: "no such topic" means try another one,
    // "Wikipedia is down" means stop trying.
    expect(result).toMatchObject({ ok: false, reason: 'unreachable' });
    expect(result.ok ? '' : result.detail).toContain('ENOTFOUND');
  });

  it('reports rate_limited on 429 rather than retrying blindly', async () => {
    const fetch = (() =>
      Promise.resolve(new Response('', { status: 429 }))) as typeof globalThis.fetch;
    expect(await fetchRenderedPage('Chat', FR, { fetch })).toMatchObject({
      ok: false,
      reason: 'rate_limited',
    });
  });

  it.each([[500], [403], [404]])('reports an unexpected HTTP %i', async (status) => {
    const fetch = (() =>
      Promise.resolve(new Response('', { status }))) as typeof globalThis.fetch;
    expect(await fetchRenderedPage('Chat', FR, { fetch })).toMatchObject({
      ok: false,
      reason: 'unexpected_response',
    });
  });

  it('reports a body that is not JSON', async () => {
    const fetch = (() =>
      Promise.resolve(
        new Response('<html>maintenance</html>', { status: 200 }),
      )) as typeof globalThis.fetch;
    expect(await fetchRenderedPage('Chat', FR, { fetch })).toMatchObject({
      ok: false,
      reason: 'unexpected_response',
    });
  });

  it('reports an answer with no usable parse block', async () => {
    const { transport } = recorder([{ parse: { title: 'Chat' } }]);
    expect(await fetchRenderedPage('Chat', FR, transport)).toMatchObject({
      ok: false,
      reason: 'unexpected_response',
    });
  });

  it('refuses an empty title without asking', async () => {
    const { transport, urls } = recorder([PAGE]);
    expect(await fetchRenderedPage('   ', FR, transport)).toMatchObject({
      ok: false,
      reason: 'not_found',
    });
    expect(urls).toEqual([]);
  });
});

describe('3.2 — no auto-suggestion', () => {
  // `wikipedia.page(results[0])` without `auto_suggest=False` can land on a
  // different article than the one searched for, and the player is then graded on
  // an article nobody chose.
  it('asks for the exact title, and follows redirects only', async () => {
    const { transport, urls } = recorder([PAGE]);
    await fetchRenderedPage('Chat', FR, transport);

    const url = new URL(urls[0] as string);
    expect(url.searchParams.get('action')).toBe('parse');
    expect(url.searchParams.get('page')).toBe('Chat');
    expect(url.searchParams.get('redirects')).toBe('1');
    // Nothing that would let the API pick a near match for us.
    expect(url.searchParams.has('srsearch')).toBe(false);
  });

  it('returns the revision the HTML came from', async () => {
    const { transport } = recorder([PAGE]);
    const result = await fetchRenderedPage('Chat', FR, transport);
    expect(result.ok && result.value.revisionId).toBe(238196699);
  });

  it('underscores the title in the page URL, and escapes it', async () => {
    const { transport } = recorder([
      { parse: { title: 'Chat de Schrödinger', revid: 1, text: '<p>x</p>' } },
    ]);
    const result = await fetchRenderedPage('Chat de Schrödinger', FR, transport);
    expect(result.ok && result.value.url).toBe(
      'https://fr.wikipedia.org/wiki/Chat_de_Schr%C3%B6dinger',
    );
  });
});

describe('3.2 — search', () => {
  it('returns the titles, best first', async () => {
    const { transport, urls } = recorder([
      { query: { search: [{ title: 'Chat' }, { title: 'Chat domestique' }] } },
    ]);
    const result = await searchTitles('chat', FR, transport);

    expect(result.ok && result.value).toEqual(['Chat', 'Chat domestique']);
    expect(new URL(urls[0] as string).searchParams.get('srsearch')).toBe('chat');
  });

  it('reports no_results rather than an empty list', async () => {
    const { transport } = recorder([{ query: { search: [] } }]);
    expect(await searchTitles('zzzz', FR, transport)).toMatchObject({
      ok: false,
      reason: 'no_results',
    });
  });

  it('refuses an empty query without asking', async () => {
    const { transport, urls } = recorder([{ query: { search: [] } }]);
    expect(await searchTitles('  ', FR, transport)).toMatchObject({
      ok: false,
      reason: 'no_results',
    });
    expect(urls).toEqual([]);
  });

  it('ignores a hit with no title rather than returning undefined', async () => {
    const { transport } = recorder([
      { query: { search: [{ title: 'Chat' }, { ns: 0 }] } },
    ]);
    const result = await searchTitles('chat', FR, transport);
    expect(result.ok && result.value).toEqual(['Chat']);
  });
});
