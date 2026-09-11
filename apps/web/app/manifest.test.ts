// The manifest, read rather than described.
//
// Three things can be wrong with it and none of them is visible on any screen:
// the words can drift from the catalogue into literals, the colours can drift
// from the theme, and it can promise an icon at a size no route draws — which
// is an install prompt with a broken picture in it, on a device the developer
// does not own.
//
// What this cannot say is whether the document is *served*. Next compiles this
// file into a route handler, and an async default export that the generated
// handler forgot to await would serve `{}` with every assertion below still
// green. `apps/e2e/specs/icons.spec.ts` fetches it.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import manifest from './manifest.js';
import { ICON_SIZES } from '../src/brand/mark.js';
import { messagesFor } from '../src/i18n/catalogue.js';
import { DEFAULT_LOCALE } from '../src/i18n/locales.js';

const document = await manifest();
const { seo } = await messagesFor(DEFAULT_LOCALE);

describe('J.2 — the manifest says what the catalogue says', () => {
  it('takes its name and its description from the catalogue', () => {
    expect(document.name).toBe(seo.title);
    expect(document.description).toBe(seo.description);
  });

  // The brand is not translated — the share card makes the same call about the
  // same word. What is asserted here is that it is short enough to survive a
  // home screen, which truncates without mercy past about twelve characters.
  it('carries a short name that fits under an icon', () => {
    expect(document.short_name).toBe('WikiFake');
    expect((document.short_name ?? '').length).toBeLessThanOrEqual(12);
  });

  // One document, one language, and it says which. A manifest with no `lang` is
  // a manifest an OS guesses the direction of.
  it('declares the locale its words are in', () => {
    expect(document.lang).toBe(DEFAULT_LOCALE);
  });

  it('opens the front door, which the proxy hands to the right language', () => {
    expect(document.start_url).toBe('/');
  });
});

describe('J.2 — and the colours the theme declares', () => {
  const THEME = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      '..',
      'packages',
      'ui',
      'src',
      'theme.css',
    ),
    'utf8',
  );

  /** The light palette's value for one `--color-*` token. */
  function token(name: string): string {
    const block = THEME.slice(THEME.indexOf('@theme static {'));
    const found = new RegExp(String.raw`--color-${name}:\s*([^;]+);`).exec(block);
    if (found === null) throw new Error(`no --color-${name} in the theme`);
    return (found[1] as string).trim().toLowerCase();
  }

  it('splashes on the paper', () => {
    expect(document.background_color).toBe(token('bg'));
  });

  it('colours the browser chrome with the accent, which is chassis', () => {
    expect(document.theme_color).toBe(token('accent'));
  });
});

describe('J.2 — and promises no icon nothing draws', () => {
  const icons = document.icons ?? [];

  it('names the installed sizes, and not the tab', () => {
    // 32 belongs in a `<link>`. A home screen given a 32px icon scales it.
    const installed = ICON_SIZES.filter((size) => size >= 192);
    expect(icons.map((icon) => icon.sizes)).toEqual(
      installed.map((size) => `${String(size)}x${String(size)}`),
    );
  });

  it('points every one of them at a size the icon route serves', () => {
    for (const icon of icons) {
      const size = Number(icon.src.split('/').pop());
      const drawn: readonly number[] = ICON_SIZES;
      expect({ src: icon.src, drawn: drawn.includes(size) }).toEqual({
        src: icon.src,
        drawn: true,
      });
      expect(icon.sizes).toBe(`${String(size)}x${String(size)}`);
      expect(icon.type).toBe('image/png');
    }
  });

  // `any` and no `maskable`: a mark whose border is the grammar cannot be
  // cropped to a circle, and a maskable variant would be a second drawing.
  it('asks for no shape the mark cannot survive', () => {
    expect(icons.every((icon) => icon.purpose === 'any')).toBe(true);
  });
});
