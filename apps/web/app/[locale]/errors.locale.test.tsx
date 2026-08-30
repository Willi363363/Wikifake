// Step 11.8 — the error surfaces, in every locale.
//
// Three pages with three different amounts of context available to them, and the
// test has to respect the difference rather than assert the same thing three
// times: two read the catalogue, one cannot and says so.
//
// Rendered to a string with `renderToStaticMarkup`, like the front door's proof
// screen: it is what these pages are in production, and a page proven that way is
// proven with no DOM to hide behind.
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { messagesFor } from '../../src/i18n/catalogue.js';
import { LOCALES, type Locale } from '../../src/i18n/locales.js';

import GlobalError from '../global-error.js';
import RootNotFound from '../not-found.js';
import LocaleError from './error.js';
import LocaleNotFound from './not-found.js';

/** A page as one locale's player receives it, catalogue mounted. */
async function inLocale(locale: Locale, ui: ReactElement): Promise<string> {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={await messagesFor(locale)}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const boom = Object.assign(new Error('boom'), { digest: 'abc123' });

describe('11.8 — a 404 inside a locale', () => {
  it('speaks English under the en locale', async () => {
    const html = await inLocale('en', <LocaleNotFound />);
    expect(html).toContain('That page is not here');
    expect(html).toContain('Back to the front door');
  });

  it('speaks French under the fr locale, with no English left', async () => {
    const html = await inLocale('fr', <LocaleNotFound />);
    expect(html).toContain('Cette page n&#x27;est pas là');
    expect(html).toContain('Revenir à l&#x27;accueil');
    expect(html).not.toContain('That page is not here');
    expect(html).not.toContain('Back to the front door');
  });

  // The whole point of the step: before it, this page did not exist and Next's
  // own English default was what a French player got.
  it.each(LOCALES)('offers a way out in %s', async (locale) => {
    const html = await inLocale(locale, <LocaleNotFound />);
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/play"');
  });
});

describe('11.8 — a render error inside a locale', () => {
  it('speaks English under the en locale', async () => {
    const html = await inLocale(
      'en',
      <LocaleError error={boom} reset={() => undefined} />,
    );
    expect(html).toContain('Something broke on our side');
    expect(html).toContain('Try that again');
  });

  it('speaks French under the fr locale, with no English left', async () => {
    const html = await inLocale(
      'fr',
      <LocaleError error={boom} reset={() => undefined} />,
    );
    expect(html).toContain('Quelque chose a cassé chez nous');
    expect(html).toContain('Réessayer');
    expect(html).not.toContain('Something broke on our side');
    expect(html).not.toContain('Try that again');
  });

  // `digest` is all Next lets across in production — the message and the stack
  // are replaced by a hash on purpose. Showing it is what makes a player's
  // report findable in the server's logs.
  it.each(LOCALES)('shows the digest in %s when there is one', async (locale) => {
    const html = await inLocale(
      locale,
      <LocaleError error={boom} reset={() => undefined} />,
    );
    expect(html).toContain('abc123');
  });

  it('says nothing about a reference when there is no digest', async () => {
    const bare = new Error('boom');
    const html = await inLocale(
      'en',
      <LocaleError error={bare} reset={() => undefined} />,
    );
    expect(html).not.toContain('Reference:');
  });

  // The error's own message must not reach the page. In development Next leaves
  // it intact, and a thrown string can carry a connection URL or a query.
  it.each(LOCALES)('never prints the error message itself, in %s', async (locale) => {
    const leaky = Object.assign(new Error('postgres://user:secret@host/db'), {
      digest: 'd1',
    });
    const html = await inLocale(
      locale,
      <LocaleError error={leaky} reset={() => undefined} />,
    );
    expect(html).not.toContain('postgres://');
    expect(html).not.toContain('secret');
  });
});

describe('11.8 — the surfaces with no catalogue to read', () => {
  // Not a gap to close later: a URL whose first segment is not a locale never
  // reaches the `[locale]` layout, so nothing has decided a language yet.
  it('the root 404 renders its own document, in English', () => {
    const html = renderToStaticMarkup(<RootNotFound />);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('That page is not here');
    expect(html).toContain('href="/"');
  });

  // `global-error` replaces the root layout, so `NextIntlClientProvider` is
  // exactly what is not mounted. It is rendered here with no provider at all —
  // which is the production condition, and a `useTranslations` inside it would
  // throw in the one place a second error has nowhere left to go.
  it('the fatal page renders with no provider, and says why it is English', () => {
    const html = renderToStaticMarkup(
      <GlobalError error={boom} reset={() => undefined} />,
    );
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('WikiFake could not start');
    expect(html).toContain('whatever language you were reading in');
    expect(html).toContain('abc123');
  });

  // Its styling is inline on purpose: the stylesheet is one of the things that
  // may have failed, and a last-resort page depending on it is not one.
  it('the fatal page carries its own styling rather than a class', () => {
    const html = renderToStaticMarkup(
      <GlobalError error={boom} reset={() => undefined} />,
    );
    expect(html).toContain('style="');
    expect(html).not.toContain('class="');
  });
});
