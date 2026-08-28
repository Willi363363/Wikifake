// C6.3, C7.3 — the tags every page inherits, and the front door being a page.
//
// The old stack asserted these by reading `index.html` with regexes, because the
// tags were written by hand there. Here they are one object, so they are read as
// one object — and the regex version of this file is the reason the assertions
// below are the same assertions: `og:image` missing is a shared link with no
// image, which is what killed propagation before anyone noticed.
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { messagesFor } from '../../src/i18n/catalogue.js';
import { SITE_DESCRIPTION, SITE_TITLE } from '../../src/indexing.js';

import { metadata, viewport } from './layout.js';
import HomePage from './page.js';

describe('C6.3 — the metadata every page starts from', () => {
  it('carries the title and the description, bounded elsewhere', () => {
    expect(metadata.title).toBe(SITE_TITLE);
    expect(metadata.description).toBe(SITE_DESCRIPTION);
  });

  it('declares a base, so a relative URL resolves to somewhere', () => {
    // Without it Next drops `alternates` and `openGraph.url` in a build, and the
    // canonical link disappears without an error.
    const base = metadata.metadataBase;
    expect(base).toBeInstanceOf(URL);
    expect(base instanceof URL ? base.protocol : '').toMatch(/^https?:$/);
  });

  it('declares a canonical URL', () => {
    // A preview and production serving the same content without one is two
    // pages competing for one place in an index.
    expect(metadata.alternates?.canonical).toBe('/');
  });

  it('carries the Open Graph tags a shared link needs', () => {
    const openGraph = metadata.openGraph;
    expect(openGraph).toBeDefined();
    expect(openGraph).toMatchObject({ title: SITE_TITLE, description: SITE_DESCRIPTION });
    // `og:url` and `og:image`, the two that a link preview cannot do without.
    expect(openGraph && 'url' in openGraph ? openGraph.url : undefined).toBeTruthy();
    expect(openGraph && 'images' in openGraph ? openGraph.images : undefined).toEqual([
      '/image.png',
    ]);
  });

  it('carries a large-image Twitter card', () => {
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
    });
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

  it('has a title to serve, and it is not empty', () => {
    expect(typeof metadata.title).toBe('string');
    expect(String(metadata.title).trim().length).toBeGreaterThan(0);
  });
});
