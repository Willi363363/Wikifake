// D13, closed by construction: the language and the user agent are decided here
// and passed on every call, so there is no global for a later caller to be wrong
// about.
import { describe, expect, it } from 'vitest';

import { VERSION } from '../deployment.js';
import { WIKI_LANGUAGE } from '@wikifake/article';

import { networkTransport, wikiRequest } from './wikipedia.js';

describe('the Wikipedia this deployment reads', () => {
  it('is the French one', () => {
    expect(WIKI_LANGUAGE).toBe('fr');
    expect(wikiRequest('https://wikifake.example').language).toBe('fr');
  });

  // Wikimedia's policy asks for an identifiable agent, and `@wikifake/article`
  // refuses an empty one outright. Naming the version is what lets an operator
  // reading their logs tell which build is making the requests.
  it('says which build is asking, and how to reach it', () => {
    const agent = wikiRequest('https://wikifake.example').userAgent;

    expect(agent).toContain('WikiFake/');
    expect(agent).toContain(VERSION);
    expect(agent).toContain('https://wikifake.example');
  });

  // `{ fetch: globalThis.fetch }` loses the receiver, and some runtimes reject
  // the detached function outright. The wrapper is not decoration.
  it('calls fetch without detaching it from its receiver', async () => {
    const original = globalThis.fetch;
    let seen: string | undefined;
    globalThis.fetch = ((input: RequestInfo | URL) => {
      seen = String(input);
      return Promise.resolve(new Response('{}'));
    }) as typeof globalThis.fetch;

    try {
      await networkTransport.fetch('https://fr.wikipedia.org/w/api.php');
      expect(seen).toBe('https://fr.wikipedia.org/w/api.php');
    } finally {
      globalThis.fetch = original;
    }
  });
});
