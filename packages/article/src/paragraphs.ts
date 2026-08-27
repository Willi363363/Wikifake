// C3.2 — index parity, made structural.
//
// This is the invariant that cost the worst bug in the project's history: the
// positions were drawn at random and the player was graded on paragraphs the
// model never touched. Everything downstream rests on `paragraphs[i]` being the
// i-th collected node — the grading, the hints, the debrief.
//
// So collection does not return two lists that have to stay aligned. It returns
// one object holding the loaded document and its nodes, and the text is derived
// from those same nodes. There is no second list to drift and no re-parse in
// between: this phase's pitfall is that "an intermediate re-parse silently
// recreates the historical bug", and the only way to be sure is to never build a
// second tree.
//
// `domhandler` is declared as a dependency because it is where cheerio's node
// types live, and this module handles nodes. Reaching for it through cheerio's
// inference produced a signature nobody could read.
import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

/**
 * C3.4 — a paragraph of 50 characters or fewer is not content.
 *
 * Image captions, taxonomy lines and disambiguation notes all fall under it.
 * Carried over from `MIN_CONTENT_CHARS`, comparison included: the current filter
 * drops `<= 50`, so 51 characters is the shortest paragraph a player can be
 * graded on.
 */
export const MIN_CONTENT_CHARS = 50;

/**
 * A loaded article: the document, the collected paragraph nodes, and their text.
 *
 * The nodes are exposed only so `injectFalsifications` can write to them. A
 * caller that re-parsed, filtered or reordered them would turn parity back into
 * a convention.
 */
export interface CollectedArticle {
  /** Normalised text, in document order. `paragraphs[i]` is `nodes[i]`. */
  readonly paragraphs: readonly string[];
  readonly document: cheerio.CheerioAPI;
  readonly nodes: readonly Element[];
}

const MULTISPACE = /\s+/g;
const SPACE_BEFORE_PUNCTUATION = /\s+([.,;:!?%)\]])/g;
const NON_BREAKING = /[\u00A0\u202F\u2009\u2007]/g;

/**
 * C3.5 — the text a player reads.
 *
 * A space is inserted between inline nodes, so `un<b>deux</b>trois` reads
 * "un deux trois" rather than "undeuxtrois". That insertion is then undone in
 * front of punctuation, or "1889." would read "1889 ." — which is exactly what a
 * naive separator produces.
 *
 * Non-breaking spaces become ordinary ones: Wikipedia uses them before units
 * and inside numbers, and a player typing the sentence back would not reproduce
 * them. Written as escapes rather than as the characters themselves — an
 * invisible character in a character class is a character class nobody can
 * review, which is what the lint rule is there to stop. U+00A0 no-break,
 * U+202F narrow no-break (French typography, before `;` and `%`), U+2009 thin,
 * U+2007 figure.
 */
export function normaliseText(raw: string): string {
  return raw
    .replace(NON_BREAKING, ' ')
    .replace(MULTISPACE, ' ')
    .replace(SPACE_BEFORE_PUNCTUATION, '$1')
    .trim();
}

/** Every descendant's text, separated by a space — `get_text(" ")`. */
function textWithSpaces(node: AnyNode): string {
  if (node.type === 'text') return node.data;
  if (!('children' in node)) return '';
  return node.children.map(textWithSpaces).join(' ');
}

/**
 * Collects the content paragraphs of a rendered Wikipedia page.
 *
 * Each `<p>` is visited **once**, in document order. The previous Python
 * implementation concatenated `find_all('p', recursive=False)` with
 * `find_all('p')` — the second already contains the first — so every top-level
 * paragraph was collected twice and the indices drifted from the document.
 *
 * C3.4 — variants are deduplicated on their normalised text. MediaWiki serves
 * some sections twice, once for mobile and once for desktop, and a player shown
 * the same paragraph twice can be graded on the copy the model never touched.
 */
export function collectParagraphs(html: string): CollectedArticle {
  const document = cheerio.load(html);
  // One selector, so the nodes arrive in document order whether or not the page
  // has a `#bodyContent` wrapper.
  const found =
    document('#bodyContent').length > 0 ? document('#bodyContent p') : document('p');

  const paragraphs: string[] = [];
  const nodes: Element[] = [];
  const seen = new Set<string>();

  for (const element of found.toArray()) {
    // The separator is what makes inline tags read as words, and the
    // deduplication key is the same text the player would see — so two nodes
    // that render identically count as one.
    const text = normaliseText(textWithSpaces(element));

    if (text.length <= MIN_CONTENT_CHARS) continue;
    if (seen.has(text)) continue;

    seen.add(text);
    paragraphs.push(text);
    nodes.push(element);
  }

  return { paragraphs, document, nodes };
}

/**
 * C3.1 — replaces the text of the paragraphs the model falsified, in place.
 *
 * Keyed by the **collected** index, which is the only index anything else uses.
 * The nodes belong to the document this article was loaded from, so the returned
 * HTML is the page the player reads with exactly those paragraphs changed — no
 * re-parse, no second tree, no chance of writing to a node other than the one
 * that will be graded.
 */
export function injectFalsifications(
  article: CollectedArticle,
  replacements: ReadonlyMap<number, string>,
): { readonly html: string; readonly paragraphs: readonly string[] } {
  const paragraphs = [...article.paragraphs];

  for (const [index, text] of replacements) {
    const node = article.nodes[index];
    if (node === undefined) {
      throw new Error(`no paragraph at collected index ${index}`);
    }
    article.document(node).text(text);
    paragraphs[index] = normaliseText(text);
  }

  return { html: article.document.html(), paragraphs };
}
