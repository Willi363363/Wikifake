// The theme names the families; this checks the application actually loads them.
//
// `packages/ui` declares `--font-sans` as `var(--font-archivo, …)`, which is a
// promise about a variable it does not define. `apps/web` is what keeps that
// promise, through `next/font/google` and the class on `<html>`.
//
// The failure this exists for is silent rather than loud: if the layout stops
// exposing a variable, nothing errors — the fallback inside the `var()` takes
// over and the whole interface renders in the system grotesque, which looks
// like a font that has not finished loading rather than like a bug.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAYOUT = readFileSync(join(HERE, '..', 'app', '[locale]', 'layout.tsx'), 'utf8');
const THEME = readFileSync(
  join(HERE, '..', '..', '..', 'packages', 'ui', 'src', 'theme.css'),
  'utf8',
);

/** Every `--font-x` the theme expects somebody else to define. */
const REQUIRED = [...THEME.matchAll(/var\((--font-[\w-]+),/g)].map((m) => m[1] as string);

describe('B.4 — the type families', () => {
  it('expects at least the two the direction names', () => {
    expect(REQUIRED).toHaveLength(2);
  });

  it('exposes every variable the theme reads', () => {
    for (const name of REQUIRED) {
      expect(LAYOUT).toContain(`variable: '${name}'`);
    }
  });

  /*
   * Declaring the fonts and never putting their classes on an element is the
   * other half, and it is the half that looks like it works in a diff.
   *
   * This used to pin the exact template literal the layout was written with.
   * L.9 had to change it — the theme class joins the two font variables on the
   * same element — and a spelling is not what this is protecting. What it holds
   * now is the property: both variables are inside the opening `<html>` tag,
   * however the tag composes its class.
   */
  it('puts both on the document element', () => {
    // Anchored on `lang=`, because the comment above the element names `<html>`
    // too and a search for the first one finds the prose.
    const tag = /<html\s[\s\S]*?lang=[\s\S]*?>/.exec(LAYOUT)?.[0] ?? '';

    expect(tag).not.toBe('');
    expect(tag).toContain('archivo.variable');
    expect(tag).toContain('jetbrainsMono.variable');
  });

  // Latin only: the interface is English and French and the articles are
  // French, so Cyrillic and Greek would be weight nothing renders.
  it('asks for the subset it renders, and no more', () => {
    expect([...LAYOUT.matchAll(/subsets: \[([^\]]*)\]/g)].map((m) => m[1])).toEqual([
      "'latin'",
      "'latin'",
    ]);
  });
});
