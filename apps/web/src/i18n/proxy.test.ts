// Steps 11.3 and 11.4 — detection, the choice that beats it, and the routing
// that keeps every legacy URL alive.
//
// The proxy is called directly, as a function, because that is what it is —
// and because the behaviour most likely to regress silently is not a screen
// but a header: a redirect that stops happening leaves a French player on an
// English page, and nothing else fails. Each "done when" of the two steps is
// a case here: a French browser lands on French, the recorded choice wins
// over `Accept-Language`, and no unprefixed URL 404s — they all resolve into
// `app/[locale]`, where the pages now live.
import { readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import proxy, { isLocaleExempt } from '../../proxy.js';

const ORIGIN = 'http://localhost:3000';

/** A request the proxy would see, with only the headers each case is about. */
function request(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`${ORIGIN}${path}`, { headers });
}

/** Where a response sends the browser, or null when it does not redirect. */
function redirectedTo(response: Response): string | null {
  const location = response.headers.get('location');
  return location === null ? null : new URL(location).pathname;
}

/** Where a response is served from internally, or null when untouched. */
function rewrittenTo(response: Response): string | null {
  const rewrite = response.headers.get('x-middleware-rewrite');
  return rewrite === null ? null : new URL(rewrite).pathname;
}

describe('11.3 — the locale defaults from the request', () => {
  it('lands a French browser on French', () => {
    const response = proxy(request('/', { 'accept-language': 'fr-FR,fr;q=0.9' }));
    expect(redirectedTo(response)).toBe('/fr');
  });

  it('keeps an English browser on the unprefixed page', () => {
    const response = proxy(request('/', { 'accept-language': 'en-US,en;q=0.9' }));
    expect(redirectedTo(response)).toBeNull();
    expect(rewrittenTo(response)).toBe('/en');
  });

  it('serves English when the browser announces nothing', () => {
    // The default of `locales.ts`: a missing header must never guess French,
    // because a missing French key falling back silently is the failure mode
    // the whole catalogue design refuses.
    const response = proxy(request('/play'));
    expect(redirectedTo(response)).toBeNull();
    expect(rewrittenTo(response)).toBe('/en/play');
  });
});

describe('11.3 — the explicit choice persists, and wins over detection', () => {
  it('honours a recorded French choice against an English browser', () => {
    const response = proxy(
      request('/play', {
        'accept-language': 'en-US,en;q=0.9',
        cookie: 'NEXT_LOCALE=fr',
      }),
    );
    expect(redirectedTo(response)).toBe('/fr/play');
  });

  it('honours a recorded English choice against a French browser', () => {
    const response = proxy(
      request('/play', {
        'accept-language': 'fr-FR,fr;q=0.9',
        cookie: 'NEXT_LOCALE=en',
      }),
    );
    expect(redirectedTo(response)).toBeNull();
    expect(rewrittenTo(response)).toBe('/en/play');
  });

  it('records a choice a URL states and detection would not have made', () => {
    // An English browser opening `/fr/play` said something its headers do
    // not: the cookie is written so the choice survives a reload — and for a
    // year, not a session, since "survives a reload" is the floor.
    const response = proxy(request('/fr/play', { 'accept-language': 'en-US,en;q=0.9' }));
    expect(redirectedTo(response)).toBeNull();
    const cookie = response.cookies.get('NEXT_LOCALE');
    expect(cookie?.value).toBe('fr');
    expect(cookie?.maxAge).toBe(60 * 60 * 24 * 365);
  });

  it('updates a recorded choice the player has just changed', () => {
    const response = proxy(
      request('/fr/play', { cookie: 'NEXT_LOCALE=en', 'sec-fetch-dest': 'document' }),
    );
    expect(response.cookies.get('NEXT_LOCALE')?.value).toBe('fr');
  });
});

/**
 * Sample values for the dynamic segments of `app/[locale]`.
 *
 * An unknown segment fails the walk on purpose: a new dynamic route must
 * decide its sample here, or the legacy-URL guarantee quietly stops covering
 * it.
 */
const SAMPLES: Record<string, string> = { '[code]': 'A1B2C3' };

/** Every page under `app/[locale]`, as the unprefixed URL it answered before. */
function legacyPages(): string[] {
  const root = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'app',
    '[locale]',
  );
  const found: string[] = [];

  const walk = (directory: string, urlPath: string): void => {
    for (const name of readdirSync(directory)) {
      const child = join(directory, name);
      if (statSync(child).isDirectory()) {
        // A route group's parentheses never reach the URL; a dynamic segment
        // is walked as its sample value.
        const segment = name.startsWith('(')
          ? ''
          : name.startsWith('[')
            ? `/${SAMPLES[name] ?? ''}`
            : `/${name}`;
        if (name.startsWith('[') && SAMPLES[name] === undefined) {
          throw new Error(`no sample value for the dynamic segment ${name}`);
        }
        walk(child, `${urlPath}${segment}`);
        continue;
      }
      if (name === 'page.tsx') found.push(urlPath === '' ? '/' : urlPath);
    }
  };

  walk(root, '');
  return found.sort();
}

describe('11.4 — no legacy URL 404s', () => {
  // The way this could pass while measuring nothing: a walk that finds no
  // page holds the guarantee over an empty list.
  it('actually found the pages', () => {
    expect(legacyPages().length).toBeGreaterThanOrEqual(4);
  });

  it.each(legacyPages())('%s still resolves for an English request', (path) => {
    const response = proxy(request(path));
    expect(response.status).toBe(200);
    expect(redirectedTo(response)).toBeNull();
    // Served from inside `app/[locale]`, where the page actually exists.
    expect(rewrittenTo(response)).toBe(path === '/' ? '/en' : `/en${path}`);
  });

  it.each(legacyPages())('%s redirects a recorded French choice', (path) => {
    const response = proxy(request(path, { cookie: 'NEXT_LOCALE=fr' }));
    expect(redirectedTo(response)).toBe(path === '/' ? '/fr' : `/fr${path}`);
  });

  it.each(legacyPages())('%s is reachable in both locales by URL', (path) => {
    // Step 11.4's other half: a URL identifies a language. French under
    // `/fr`, English on the legacy path itself — asserted above.
    const french = proxy(request(path === '/' ? '/fr' : `/fr${path}`));
    expect(french.status).toBe(200);
    expect(redirectedTo(french)).toBeNull();
  });

  it('strips the default locale prefix rather than serving one page twice', () => {
    // `/en/play` and `/play` answering the same document would be two URLs
    // competing for one place in an index — the exact thing C6.3's canonical
    // link exists to prevent.
    const response = proxy(request('/en/play'));
    expect(redirectedTo(response)).toBe('/play');
  });
});

describe('11.4 — the paths that are not pages are left alone', () => {
  it.each(['/api/health', '/api/game/start', '/ping', '/robots.txt', '/sitemap.xml'])(
    'leaves %s untouched',
    (path) => {
      expect(isLocaleExempt(path)).toBe(true);
      const response = proxy(request(path, { cookie: 'NEXT_LOCALE=fr' }));
      expect(redirectedTo(response)).toBeNull();
      expect(rewrittenTo(response)).toBeNull();
    },
  );

  it.each(legacyPages())('does not exempt the page %s', (path) => {
    expect(isLocaleExempt(path)).toBe(false);
  });
});
