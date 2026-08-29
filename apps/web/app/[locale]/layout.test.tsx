// C6.3, C7.3 — the tags every page inherits, and the front door being a page.
//
// The old stack asserted these by reading `index.html` with regexes, because
// the tags were written by hand there. Here they are one function of the
// locale — per locale since step 11.5 — so they are read by calling it: once
// per locale, the way Next does. The bounds that used to hold two English
// constants in `src/indexing.ts` now hold every locale's catalogue entry,
// because a truncated French title is as silent a loss as a truncated
// English one.
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { messagesFor } from '../../src/i18n/catalogue.js';
import { LOCALES, type Locale } from '../../src/i18n/locales.js';

import { generateMetadata, viewport } from './layout.js';
import HomePage from './page.js';

/** The metadata as Next asks for it: from the routed `[locale]` segment. */
async function metadataFor(locale: string) {
  return generateMetadata({ params: Promise.resolve({ locale }) });
}

describe('C6.3 — the metadata every page starts from, per locale', () => {
  it.each(LOCALES)('serves %s the catalogue title and description', async (locale) => {
    const metadata = await metadataFor(locale);
    const { seo } = await messagesFor(locale);

    expect(metadata.title).toBe(seo.title);
    expect(metadata.description).toBe(seo.description);
  });

  it.each(LOCALES)('keeps the %s title and description within bounds', async (locale) => {
    // Under 20 a search result says nothing; over 80 it is cut off. Under 70 a
    // description earns no click; over 320 it is truncated. The old test's
    // bounds, now held per locale.
    const { seo } = await messagesFor(locale);

    expect(seo.title.length).toBeGreaterThanOrEqual(20);
    expect(seo.title.length).toBeLessThanOrEqual(80);
    expect(seo.description.length).toBeGreaterThan(70);
    expect(seo.description.length).toBeLessThan(320);
  });

  it('serves each locale its own words, not one locale twice', async () => {
    // The amendment's point: per-locale metadata that is the same string per
    // locale is the old single-value metadata wearing a parameter.
    const [en, fr] = await Promise.all([metadataFor('en'), metadataFor('fr')]);

    expect(en.title).not.toBe(fr.title);
    expect(en.description).not.toBe(fr.description);
  });

  it('keeps the metadata description and the front door speaking one sentence', async () => {
    // The successor of the pin that held `SITE_DESCRIPTION` to the catalogue:
    // the sentence a search result shows and the sentence the page opens with
    // are the same message, per locale, or they drift apart quietly.
    for (const locale of LOCALES) {
      const { seo, home } = await messagesFor(locale);
      expect(seo.description).toBe(home.description);
    }
  });

  it('declares a base, so a relative URL resolves to somewhere', async () => {
    // Without it Next drops `alternates` and `openGraph.url` in a build, and the
    // canonical link disappears without an error.
    const base = (await metadataFor('en')).metadataBase;
    expect(base).toBeInstanceOf(URL);
    expect(base instanceof URL ? base.protocol : '').toMatch(/^https?:$/);
  });

  it("declares each locale's own canonical URL", async () => {
    // A preview and production serving the same content without one is two
    // pages competing for one place in an index — and so are two locales
    // both claiming `/`.
    expect((await metadataFor('en')).alternates?.canonical).toBe('/');
    expect((await metadataFor('fr')).alternates?.canonical).toBe('/fr');
  });

  it.each(LOCALES)(
    'names every locale as an hreflang alternate under %s',
    async (locale) => {
      // Both directions from both pages, or a crawler that lands on one locale
      // never learns the other exists. `x-default` is the language-less URL:
      // the proxy answers it by detection (step 11.3).
      const metadata = await metadataFor(locale);

      expect(metadata.alternates?.languages).toEqual({
        en: '/',
        fr: '/fr',
        'x-default': '/',
      });
    },
  );

  it.each(LOCALES)(
    'carries the Open Graph tags a shared link needs, in %s',
    async (locale) => {
      const metadata = await metadataFor(locale);
      const { seo } = await messagesFor(locale);

      const openGraph = metadata.openGraph;
      expect(openGraph).toBeDefined();
      expect(openGraph).toMatchObject({ title: seo.title, description: seo.description });
      // `og:url` and `og:image`, the two that a link preview cannot do without.
      expect(openGraph && 'url' in openGraph ? openGraph.url : undefined).toBeTruthy();
      expect(openGraph && 'images' in openGraph ? openGraph.images : undefined).toEqual([
        '/image.png',
      ]);
    },
  );

  it('declares the og:locale of the interface, with the other as alternate', async () => {
    // The pair the layout has to keep together: a document whose `lang` says
    // one language while `og:locale` says another is lying to somebody.
    const [en, fr] = await Promise.all([metadataFor('en'), metadataFor('fr')]);

    expect(en.openGraph).toMatchObject({ locale: 'en_US', alternateLocale: ['fr_FR'] });
    expect(fr.openGraph).toMatchObject({ locale: 'fr_FR', alternateLocale: ['en_US'] });
  });

  it.each(LOCALES)('carries a large-image Twitter card in %s', async (locale) => {
    const { seo } = await messagesFor(locale);

    expect((await metadataFor(locale)).twitter).toMatchObject({
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
    });
  });

  it('refuses a segment that is not a locale', async () => {
    // `notFound()` throws, so an invented prefix is a 404 rather than an
    // English page under a URL that claims another language.
    await expect(metadataFor('de')).rejects.toThrow();
  });

  it('still declares the viewport rather than leaving it to a default', () => {
    expect(viewport.width).toBe('device-width');
  });
});

describe('C7.3 — the front door is a page, not a redirect', () => {
  it('renders a document instead of navigating away', async () => {
    // Until step 10.0 this module called `redirect('/play')`, which answers 307
    // and no document at all — while C7.3 asks for HTML 200 with a non-empty
    // `<title>`, and the sitemap declares this very URL. Rendering the component
    // is what proves it: `redirect` throws, through the render as well, so a
    // reinstated redirect fails here rather than only in a browser. Rendered
    // through the provider since step 11.1, because the page reads its copy
    // from the catalogue — the way it ships.
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={await messagesFor('en')}>
        <HomePage />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('<main');
  });

  it.each(LOCALES)(
    'has a title to serve in %s, and it is not empty',
    async (locale: Locale) => {
      const title = (await metadataFor(locale)).title;
      expect(typeof title).toBe('string');
      expect(String(title).trim().length).toBeGreaterThan(0);
    },
  );
});
