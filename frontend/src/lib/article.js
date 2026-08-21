/**
 * The article model.
 *
 * The backend sends flat paragraph strings and the number of sabotaged
 * paragraphs — but NOT which ones. `buildArticle` therefore produces an
 * article whose tokens carry no `fake`, and `withSolution` folds the
 * correction in once the server sends it (end of round).
 *
 * A body is a list of blocks; a block holds paragraphs; a paragraph is a list
 * of segments. A segment is either a plain string, a `link`, or a clickable
 * `token`. Tokens carrying a `fake` are the ones the player was hunting.
 */

/** Token id for a 1-based paragraph index, and the reverse. */
export const tokenIdFor = (paragraphIndex) => `p${paragraphIndex - 1}`;
export const fakeIdFor = (paragraphIndex) => `F${paragraphIndex - 1}`;
export const paragraphIndexOf = (tokenId) => Number(String(tokenId).slice(1)) + 1;

/**
 * @param {object} payload Backend `game_start` / `/api/game/start` data.
 * @returns {{title, subtitle, infobox, body, fakes, totalFakes}} The renderable article.
 */
export function buildArticle(payload) {
  const paragraphs = (payload.paragraphs || []).map((text, index) => [{
    kind: 'token',
    id: `p${index}`,
    text,
    // Inconnu à ce stade : le serveur ne dira quels paragraphes sont
    // falsifiés qu'à la fin de la manche.
    fake: null,
  }]);

  const totalFakes = payload.total_fakes ?? 0;

  return {
    title: payload.topic,
    subtitle: 'Wikipedia',
    // Exposé à part : l'attribution CC BY-SA en a besoin, et la chercher dans
    // l'infobox par son libellé est fragile.
    sourceUrl: payload.wikipedia_url || '',
    infobox: [
      { label: 'DESIGNATION', value: payload.topic },
      { label: 'SOURCE', value: payload.wikipedia_url || 'Wikipedia' },
      { label: 'FAKES INJECTED', value: String(totalFakes) },
      { label: 'STATUS', value: 'LIVE', live: true },
    ],
    body: [{ kind: 'lead', paragraphs }],
    /** Vide pendant la manche ; rempli par `withSolution`. */
    fakes: [],
    totalFakes,
  };
}

/**
 * Fold the server's correction into the article, for the reveal and debrief.
 *
 * @param {object} article  Article built by `buildArticle`.
 * @param {Array}  positions `game_end.positions` / `/api/game/submit` positions.
 */
export function withSolution(article, positions) {
  if (!positions?.length) return article;

  const byIndex = new Map(positions.map((position) => [position.paragraph_index, position]));

  const body = article.body.map((block) => ({
    ...block,
    paragraphs: (block.paragraphs || []).map((segments) => segments.map((segment) => {
      if (segment.kind !== 'token') return segment;
      const position = byIndex.get(paragraphIndexOf(segment.id));
      if (!position) return segment;
      return {
        ...segment,
        fake: {
          id: fakeIdFor(position.paragraph_index),
          truth: position.explanation || 'A identifier',
          hint: position.hint || 'Vérifiez cette information',
        },
      };
    })),
  }));

  const fakes = positions.map((position) => ({
    id: fakeIdFor(position.paragraph_index),
    tokenId: tokenIdFor(position.paragraph_index),
    text: position.false_statement,
    level: 1,
    truth: position.explanation,
    hint: position.hint,
  }));

  return { ...article, body, fakes, totalFakes: article.totalFakes || fakes.length };
}

/**
 * Placeholder targets for the Intel panel.
 *
 * The player knows how many sabotaged paragraphs there are, not which ones —
 * so the panel lists numbered targets and fills each in as its hint is bought.
 */
export function hintTargets(totalFakes) {
  return Array.from({ length: totalFakes }, (_, i) => ({
    id: `T${i + 1}`,
    number: i + 1,
    hint: '',
    truth: '',
  }));
}

/** The article's source URL, as recorded in the infobox. */
export function articleUrl(article) {
  return article?.infobox?.find((fact) => fact.label === 'SOURCE')?.value || '';
}

/** Flatten the body to readable paragraph strings (used by the flag report). */
export function paragraphTexts(article) {
  return (article?.body || [])
    .flatMap((block) => block.paragraphs || [])
    .map((segments) => segments.map((seg) => seg.text || '').join(' ').trim())
    .filter((text) => text.length > 20);
}
