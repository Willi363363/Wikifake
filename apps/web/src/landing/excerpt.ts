// The paragraph the landing demonstrates the game on.
//
// Step C.1. Beat 3 of `plans/product/03-landing.md` is the product
// demonstration: a true paragraph, the same paragraph with one fact rewritten,
// and the difference pointed at. That only demonstrates anything if the true
// half is genuinely true, so this is a real extract from a real article, frozen
// at a named revision rather than written to look like one.
//
// **It is French, in both locales, and that is the product rather than an
// oversight.** The game reads `fr.wikipedia.org`, so a player of the English
// interface reads French articles; a landing that showed an English extract
// would be advertising a game that does not exist. `CLAUDE.md` states the rule
// — article content is data, not our prose — and the surrounding copy is what
// carries the explanation in the reader's language.
//
// Which is also why the falsified fact is a *number*: `beats.collision.tell`
// names both values through placeholders, so a visitor who reads no French at
// all still sees what changed.
//
// Reusing it obliges us under CC BY-SA exactly as a round does: credit, the
// licence, and the statement that the text was modified. `<Attribution>` is the
// round's, rendered here with the same words — one legal sentence, one place.

/** Where the extract comes from, and what of it the game rewrote. */
export const EXCERPT = {
  /** The article title, as `fr.wikipedia.org` spells it. */
  topic: 'Tour Eiffel',
  sourceUrl: 'https://fr.wikipedia.org/wiki/Tour_Eiffel',
  /**
   * The exact revision this text was taken from, on 2026-09-06.
   *
   * A bare article link is where the paragraph *used* to be: Wikipedia moves,
   * and a quotation whose source cannot be checked is a quotation nobody can
   * disprove. This URL still answers with the words below.
   */
  revisionUrl: 'https://fr.wikipedia.org/w/index.php?oldid=239220518',

  /*
   * The paragraph in three pieces, because one of them is marked.
   *
   * Not a catalogue entry assembled from fragments — that rule is about
   * sentences a translator has to reorder, and this sentence is never
   * translated. The split is where the falsification lands, and it is the only
   * place the two versions differ: `before + truth + after` is what Wikipedia
   * says, `before + claim + after` is what a round would show.
   */
  before: 'La tour Eiffel [tuʁɛfɛl] est une tour autoportante de fer puddlé de ',
  /** What the article says. 330 metres, with the non-breaking space Wikipedia uses. */
  truth: '330\u00a0m',
  /** What a falsified round would say instead. */
  claim: '290\u00a0m',
  after:
    ' de hauteur située à Paris, à l’extrémité nord-ouest du parc du Champ-de-Mars en bordure de la Seine dans le 7e\u00a0arrondissement. Son adresse officielle est 5, avenue Anatole-France.',
} as const;

/** The extract as Wikipedia has it. */
export const TRUE_PARAGRAPH = `${EXCERPT.before}${EXCERPT.truth}${EXCERPT.after}`;

/** The same extract with its one fact rewritten, as a round would serve it. */
export const FALSE_PARAGRAPH = `${EXCERPT.before}${EXCERPT.claim}${EXCERPT.after}`;

/*
 * The same extract, shortened for the share card — step C.8.
 *
 * **Derived rather than retyped**, and that is the whole point: a card is
 * 1200×630 and the paragraph above is four lines in it, so it has to be cut —
 * and a cut quotation typed out a second time is a quotation that drifts from
 * the revision it claims to come from. `excerpt.test.ts` holds both of these to
 * being the text above with something removed and nothing added.
 *
 * Two cuts, each for a reason a reader can check:
 *
 * - the **pronunciation gloss**, which is authentically Wikipedia's and is
 *   clutter at a glance;
 * - everything after the first clause of the tail, because the tower's street
 *   address is not what the card is demonstrating.
 */
export const SHARE_BEFORE = EXCERPT.before.replace(/\s*\[[^\]]+\]/, '');

/** The tail to its first clause boundary, with the cut marked as a cut. */
export const SHARE_AFTER = `${EXCERPT.after.slice(0, EXCERPT.after.indexOf(','))}…`;
