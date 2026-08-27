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

describe('8.10 — the interface is in English', () => {
  it('has sources to check', () => {
    expect(SOURCES.length).toBeGreaterThan(30);
  });

  it.each(FRENCH)('says no %s', (word) => {
    const offenders = SOURCES.filter(({ text }) =>
      new RegExp(String.raw`(?<![\w-])${word}(?![\w-])`, 'i').test(text),
    ).map(({ path }) => path);

    expect(offenders).toEqual([]);
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

  it('leaves the document’s own lang to step 11.5', () => {
    // C6.3 is a clause of the contract, and phase 11 amends the clause and this
    // test together when `lang` becomes per-locale. Changing it in a step that
    // does not own it is how a preserved guarantee goes quietly.
    const layout = code(readFileSync(join(WEB, 'app', 'layout.tsx'), 'utf8'));
    expect(layout).toContain('<html lang="fr">');
  });
});
