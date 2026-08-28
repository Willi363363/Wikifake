// C6.2, C6.3, C7.3 — indexing, sharing, and the front door.
//
// The successor to `frontend/src/__tests__/indexing.test.js`, which is the one
// test of the old stack that had no equivalent here: the compliance surface was
// never given to a phase, so nothing failed to deliver it and nothing said so.
// Step 10.0 is that hole, and this file is the cell it fills in
// `plans/rewrite/phase-10-contract-map.md`.
//
// Why it matters more here than the coverage number suggests: the game serves
// Wikipedia articles whose facts are deliberately false. Indexed, they are
// presented as encyclopaedic and attributed to Wikipedia. The old `robots.txt`
// carried a comment calling that the most serious risk the project holds, and it
// was right.
import { describe, expect, it } from 'vitest';

import robots from '../app/robots.js';
import sitemap from '../app/sitemap.js';
import { LOCALES } from './i18n/locales.js';
import {
  absolute,
  CRAWLERS_KEPT_OUT,
  INDEXABLE_ROUTES,
  localePath,
  robotsRules,
  siteOrigin,
  sitemapEntries,
  TRAINING_CRAWLERS,
} from './indexing.js';

/** An environment with none of the variables, so a default is a default. */
const BARE = {} as const;

describe('C6.2 — robots.txt', () => {
  const rules = robotsRules(BARE);
  const everybody = rules.rules.find((rule) => rule.userAgent === '*');

  it('keeps every crawler out of the API and the sockets', () => {
    expect(everybody?.disallow).toContain('/api/');
    expect(everybody?.disallow).toContain('/ws/');
  });

  it('keeps them out of the screens that render a falsified article', () => {
    // The article arrives over the socket, so a crawl yields a shell — but a
    // shell in an index is still a page claiming a Wikipedia subject.
    expect(everybody?.disallow).toContain('/room/');
    expect(everybody?.disallow).toContain('/solo');
  });

  it('keeps them out of the same screens under a locale prefix', () => {
    // Step 11.4 gave French its own routes: `/fr/room/...` renders the same
    // falsified article as `/room/...`, and a disallow that names only the
    // unprefixed path invites a crawler in through the prefixed one.
    expect(everybody?.disallow).toContain('/fr/room/');
    expect(everybody?.disallow).toContain('/fr/solo');
    expect(everybody?.disallow).toContain('/fr/gallery');
  });

  it('still lets the pages that are ours be read', () => {
    expect(everybody?.allow).toContain('/');
  });

  it.each(TRAINING_CRAWLERS)('refuses %s outright', (crawler) => {
    const rule = rules.rules.find((entry) => entry.userAgent === crawler);
    expect(rule).toBeDefined();
    // Everything, not a path list: this corpus is misinformation by
    // construction and has no business in a training set.
    expect(rule?.disallow).toEqual(['/']);
  });

  it('names the four the contract names, and no fewer', () => {
    expect([...TRAINING_CRAWLERS]).toEqual([
      'GPTBot',
      'ClaudeBot',
      'Google-Extended',
      'CCBot',
    ]);
  });

  it('declares the sitemap as an absolute URL', () => {
    expect(rules.sitemap).toBe('http://localhost:3000/sitemap.xml');
    expect(() => new URL(rules.sitemap)).not.toThrow();
  });

  it('is what the route actually serves', () => {
    expect(robots()).toEqual(robotsRules());
  });
});

describe('C6.2 — sitemap.xml', () => {
  const entries = sitemapEntries(BARE);

  it('declares the front door first', () => {
    expect(entries[0]?.url).toBe('http://localhost:3000/');
  });

  it('declares every locale of every publishable route', () => {
    // Step 11.5: the French pages carry hreflang alternates, but a sitemap
    // that names only English is still a sitemap that hides half the site.
    const urls = entries.map((entry) => entry.url);
    for (const route of INDEXABLE_ROUTES) {
      for (const locale of LOCALES) {
        expect(urls).toContain(absolute(localePath(locale, route), BARE));
      }
    }
  });

  it('gives the locales of one route the same priority', () => {
    // They are the same page in two languages, not two pages competing.
    const roots = entries.filter((entry) =>
      LOCALES.some((locale) => entry.url === absolute(localePath(locale, '/'), BARE)),
    );
    expect(new Set(roots.map((entry) => entry.priority)).size).toBe(1);
  });

  it('gives every entry an absolute URL', () => {
    for (const entry of entries) {
      expect(() => new URL(entry.url)).not.toThrow();
      expect(entry.url.startsWith('http')).toBe(true);
    }
  });

  it('declares nothing robots.txt keeps crawlers out of', () => {
    // Under every locale's prefix, since both live in the sitemap now.
    for (const route of INDEXABLE_ROUTES) {
      for (const locale of LOCALES) {
        for (const kept of CRAWLERS_KEPT_OUT) {
          expect(localePath(locale, route).startsWith(kept)).toBe(false);
          expect(localePath(locale, route).startsWith(localePath(locale, kept))).toBe(
            false,
          );
        }
      }
    }
  });

  it('is what the route actually serves', () => {
    expect(sitemap()).toEqual(sitemapEntries());
  });
});

describe('the origin a canonical link is built on', () => {
  it('is localhost when no platform says otherwise', () => {
    expect(siteOrigin(BARE)).toBe('http://localhost:3000');
  });

  it('prefers the variable a deployment set on purpose', () => {
    expect(
      siteOrigin({
        NEXT_PUBLIC_SITE_URL: 'https://wikifake.app',
        VERCEL_URL: 'preview-abc123.vercel.app',
      }),
    ).toBe('https://wikifake.app');
  });

  it('takes production over the preview when both are present', () => {
    expect(
      siteOrigin({
        VERCEL_PROJECT_PRODUCTION_URL: 'wikifake.vercel.app',
        VERCEL_URL: 'preview-abc123.vercel.app',
      }),
    ).toBe('https://wikifake.vercel.app');
  });

  it('adds the scheme Vercel leaves off', () => {
    expect(siteOrigin({ VERCEL_URL: 'preview-abc123.vercel.app' })).toBe(
      'https://preview-abc123.vercel.app',
    );
  });

  it('drops a trailing slash, so a canonical is never a double one', () => {
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: 'https://wikifake.app/' })).toBe(
      'https://wikifake.app',
    );
    expect(absolute('/play', { NEXT_PUBLIC_SITE_URL: 'https://wikifake.app/' })).toBe(
      'https://wikifake.app/play',
    );
  });

  it('keeps the root a single slash', () => {
    expect(absolute('/', BARE)).toBe('http://localhost:3000/');
  });
});

// C6.3 — the title and description bounds moved with the strings themselves:
// per locale, in `app/[locale]/layout.test.tsx`, against the `seo` zone of the
// catalogue (step 11.5).
