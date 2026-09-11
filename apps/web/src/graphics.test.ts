// Every graphic says what it is, or says it is nothing — step J.6.
//
// The audit of J.1 expected an `alt` text pass and found almost nothing to
// audit: **there is no `<img>` and no `next/image` anywhere in this
// application**. The article is text, the share card and the icons are
// generated metadata routes whose alt Next fills from the file convention, and
// the only graphics in the interface are two inline `<svg>`.
//
// One of them was unlabelled — the arrow marking another player's cursor —
// which a screen reader announces as a graphic that means nothing, beside the
// name it decorates. J.6 is that one attribute.
//
// The rest of this file is what keeps the pass from being a one-off. A pass
// done by hand is a pass done once, and the next `<svg>` somebody pastes in
// arrives unlabelled unless something refuses it. So, like `fills.test.ts`:
// a **source scan**, because a rendering test only ever checks the screens
// somebody thought to render, and the point here is the one nobody thought of.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const ROOT = join(HERE, '..', '..', '..');
const UI = join(ROOT, 'packages', 'ui', 'src');

interface Source {
  readonly path: string;
  readonly text: string;
}

function sourcesIn(directory: string, root: string): Source[] {
  return readdirSync(directory).flatMap((name) => {
    if (name === 'node_modules' || name === '.next') return [];
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourcesIn(path, root);
    if (!/\.tsx?$/.test(name) || name.includes('.test.')) return [];
    return [{ path: path.slice(root.length + 1), text: readFileSync(path, 'utf8') }];
  });
}

/**
 * Both trees, because a graphic does not care which package it is in.
 *
 * `packages/ui` owns the primitives and `apps/web` the screens; the dialog's
 * close icon lives in one and the cursor arrow in the other, and a rule that
 * covered only the second would have passed while the first was wrong.
 */
const SOURCES: Source[] = [
  ...sourcesIn(join(WEB, 'src'), WEB),
  ...sourcesIn(join(WEB, 'app'), WEB),
  ...sourcesIn(UI, ROOT),
];

/**
 * The same sources with their comments removed.
 *
 * The components carry a line saying *why* their icon is hidden, so that the
 * next reader learns the rule rather than rediscovering it — and a scan that
 * read those comments would fail on the explanation of its own fix.
 */
const CODE: Source[] = SOURCES.map(({ path, text }) => ({
  path,
  text: text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1'),
}));

/**
 * Every opening tag of `element`, with the file it is in.
 *
 * `[^>]*` crosses newlines, which is what makes a multi-line JSX tag one match.
 * It would also stop early at a `>` inside an attribute expression — `{a > b}`
 * in an `<svg>` tag — which nothing here does and which would show up as a
 * false failure rather than as a silent pass.
 */
function openingTags(element: string): { path: string; tag: string }[] {
  return CODE.flatMap(({ path, text }) =>
    [...text.matchAll(new RegExp(String.raw`<${element}\b[^>]*>`, 'g'))].map((match) => ({
      path,
      tag: match[0],
    })),
  );
}

/** An icon nobody needs announced: hidden, and not reachable by keyboard. */
const hidden = (tag: string) => /\baria-hidden\b/.test(tag);

/** An icon that carries meaning: named, and declared as an image. */
const named = (tag: string) => /\brole="img"/.test(tag) && /\baria-label[=\s]/.test(tag);

describe('J.6 — every graphic is labelled or hidden', () => {
  it('has sources to check', () => {
    // A scan of nothing passes everything. This is the line that says the walk
    // found the tree, and it covers both packages rather than one.
    expect(SOURCES.length).toBeGreaterThan(60);
    expect(SOURCES.some(({ path }) => path.startsWith('packages'))).toBe(true);
  });

  it('finds the icons it is here to check', () => {
    // The second line of the same defence: a regex that matched nothing would
    // pass every case below without anybody noticing it had stopped working.
    expect(openingTags('svg').length).toBeGreaterThan(1);
  });

  /*
   * Every `<svg>` is one or the other, and never neither.
   *
   * Neither is the state this step found: a graphic announced as "graphic",
   * with no name, next to the name it was decorating. Both answers are correct
   * and the choice is a design decision — what is not correct is leaving it
   * unmade.
   */
  it('leaves no svg unlabelled', () => {
    const offenders = openingTags('svg')
      .filter(({ tag }) => !hidden(tag) && !named(tag))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  /*
   * There is no `<img>` today, and the rule is written for the day there is.
   *
   * An empty `alt` is a legitimate answer — it is how HTML says "decorative" —
   * so what this refuses is the attribute being **absent**, which is the state
   * where a screen reader reads the file name out instead.
   */
  it('gives every img an alt, even an empty one', () => {
    const offenders = openingTags('img')
      .filter(({ tag }) => !/\balt[=\s]/.test(tag))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  it('gives every next/image an alt', () => {
    const offenders = openingTags('Image')
      .filter(({ tag }) => !/\balt[=\s]/.test(tag))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });
});

describe('J.6 — the scan reads code and not commentary', () => {
  /*
   * Its own comment-stripping, tested.
   *
   * This file's header describes an unlabelled `<svg>` — the one J.6 fixed —
   * and a scan that read its own explanation would fail for ever afterwards.
   * `fills.test.ts` carries the same guard for the same reason.
   */
  it('ignores a tag inside a comment', () => {
    const commented = {
      path: 'imaginary.tsx',
      text: [
        '// <svg viewBox="0 0 1 1">',
        '/* <img src="x.png"> */',
        'const a = 1;',
      ].join('\n'),
    };

    const stripped = commented.text
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    expect(stripped).not.toContain('<svg');
    expect(stripped).not.toContain('<img');
  });
});
