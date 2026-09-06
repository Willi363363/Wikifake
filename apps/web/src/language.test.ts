// The interface speaks English, and stays speaking it.
//
// Step 8.10's criterion is "no French player-facing string remains", and a
// criterion checked once is a criterion that lasts until the next screen. So it
// is a scan, in the shape of `realtime/tree.test.ts`: over the sources, with the
// comments stripped, because half the files here explain in French prose what
// the current game says in French.
//
// The one deliberate exception is the whole reason this is not simply "no
// accented characters": the article, its title and the topics players type come
// from `fr.wikipedia.org`. That is data, not prose of ours — it keeps its own
// `lang`, and phase 11's pitfall list says so in as many words.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

/**
 * Words that would only be in a file because somebody wrote interface copy.
 *
 * Deliberately not a language detector. A short list of unambiguous French
 * function words catches a sentence written by hand, which is the only way
 * French gets onto a screen here; it will not catch a single French noun, and
 * does not try to.
 */
const FRENCH = [
  'vous',
  'votre',
  'vos',
  'êtes',
  'avez',
  'cette',
  'une',
  'des',
  'aux',
  'pour',
  'avec',
  'dans',
  'sans',
  'très',
  'déjà',
  'aucun',
  'erreur',
  'erreurs',
  'joueur',
  'joueurs',
  'manche',
  'indice',
  'indices',
  'thème',
  'signaler',
  'fermer',
];

function sourcesIn(directory: string): { path: string; text: string }[] {
  return readdirSync(directory).flatMap((name) => {
    if (name === 'node_modules' || name === '.next') return [];
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourcesIn(path);
    // Tests are excluded, and that is not a loophole: their fixtures are
    // French articles, because a French article is what the game reads.
    if (!/\.tsx?$/.test(name) || name.includes('.test.')) return [];
    return [{ path: path.slice(WEB.length + 1), text: readFileSync(path, 'utf8') }];
  });
}

/** The file with its comments removed. Same reason as in `tree.test.ts`. */
function code(text: string): string {
  return text.replaceAll(/\/\*[\s\S]*?\*\//g, ' ').replaceAll(/\/\/[^\n]*/g, ' ');
}

const SOURCES = [...sourcesIn(join(WEB, 'src')), ...sourcesIn(join(WEB, 'app'))].map(
  (source) => ({ ...source, text: code(source.text) }),
);

/**
 * The files that hold `fr.wikipedia.org`'s words rather than ours.
 *
 * The exception this scan's own header names, arrived at last: article content
 * is data, not interface prose, and until step C.1 all of it reached the screen
 * through a fixture or a request. The landing quotes a real extract — that is
 * the whole of its beat 3 — so for the first time French article text is a
 * literal in a source file.
 *
 * Named rather than detected, exact rather than a floor, and each entry has to
 * still be French for the list to be right: an exemption nobody removes is how
 * a scan quietly shrinks to nothing.
 */
const ARTICLE_DATA = [join('src', 'landing', 'excerpt.ts')];

/** Everything this scan is responsible for: our prose, and only ours. */
const OURS = SOURCES.filter(({ path }) => !ARTICLE_DATA.includes(path));

/** Whether `text` uses `word` as a word. */
function uses(text: string, word: string): boolean {
  return new RegExp(String.raw`(?<![\w-])${word}(?![\w-])`, 'i').test(text);
}

describe('8.10 — the interface is in English', () => {
  it('has sources to check', () => {
    expect(SOURCES.length).toBeGreaterThan(30);
  });

  it.each(FRENCH)('says no %s', (word) => {
    const offenders = OURS.filter(({ text }) => uses(text, word)).map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  // Guards the exemption. A path that stopped carrying article data, or one
  // that never existed, leaves this scan smaller than it reads — so the list is
  // held to being exactly the files that would fail without it.
  it('exempts only files that really carry article data', () => {
    const french = ARTICLE_DATA.filter((path) => {
      const source = SOURCES.find((candidate) => candidate.path === path);
      return source !== undefined && FRENCH.some((word) => uses(source.text, word));
    });

    expect(french).toEqual(ARTICLE_DATA);
  });

  // Guards the guard: a scan whose markers no longer appear anywhere, in any
  // form, is a scan that would pass on a fully French rewrite.
  it('would notice, if there were something to notice', () => {
    const french = 'Signaler une erreur pour vous';
    const caught = FRENCH.filter((word) =>
      new RegExp(String.raw`(?<![\w-])${word}(?![\w-])`, 'i').test(french),
    );
    expect(caught.length).toBeGreaterThan(3);
  });
});

describe('8.10 — the article keeps its own language', () => {
  // Stripped, like everything else here: the file explains in a comment why the
  // attribute is there, and a scan that reads its own explanation is a scan to
  // be argued with rather than fixed.
  const article = code(readFileSync(join(WEB, 'src', 'round', 'article.tsx'), 'utf8'));

  // Phase 11's pitfall, applied early: article content is not interface text.
  // Titles, paragraphs and topics come from `fr.wikipedia.org` and stay French
  // under an English interface — so they carry their own `lang`, or a screen
  // reader reads French prose in an English voice.
  it('marks the body and the title as French', () => {
    expect(article).toContain('lang="fr"');
    expect(article.match(/lang="fr"/g)).toHaveLength(2);
  });

  it('gives the document the locale’s lang, not a hardcoded one', () => {
    // C6.3, as amended by step 11.5: the document says what the interface
    // speaks. Until that step this test locked `<html lang="fr">` — the legacy
    // stack's value — and it was amended together with the contract clause, in
    // the same change as the behaviour, the way phase 11 requires. What must
    // never come back is a constant: a hardcoded `lang` on the document makes
    // one locale lie, whichever constant is picked.
    //
    // Matched as a pattern rather than as the exact opening tag: step B.4 added
    // the font variables to that same element, and an assertion that breaks
    // when an unrelated attribute lands beside the one it cares about is an
    // assertion people learn to edit rather than to read. What it holds is
    // unchanged — `lang` is the locale, and `lang` is never a constant.
    const layout = code(readFileSync(join(WEB, 'app', '[locale]', 'layout.tsx'), 'utf8'));
    expect(layout).toMatch(/<html[^>]*\slang=\{locale\}/);
    expect(layout).not.toMatch(/<html[^>]*\slang="/);
  });
});
