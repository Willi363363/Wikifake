/**
 * The article model.
 *
 * The backend sends flat paragraph strings plus the positions it sabotaged.
 * This module turns that payload into the single structure every gameplay
 * surface reads — replacing the window globals the first version relied on.
 *
 * A body is a list of blocks; a block holds paragraphs; a paragraph is a list
 * of segments. A segment is either a plain string, a `link`, or a clickable
 * `token`. Tokens carrying a `fake` are the ones the player is hunting.
 */

/**
 * @param {object} payload Backend `game_start` / `/api/game/start` data.
 * @returns {{title, subtitle, infobox, body, fakes}} The renderable article.
 */
export function buildArticle(payload) {
  const positionsByParagraph = new Map(
    (payload.positions || []).map((pos) => [pos.paragraph_index, pos]),
  );

  const paragraphs = (payload.paragraphs || []).map((text, index) => {
    // The backend numbers paragraphs from 1; the token ids stay 0-based.
    const sabotage = positionsByParagraph.get(index + 1);
    return [{
      kind: 'token',
      id: `p${index}`,
      text,
      fake: sabotage
        ? {
            id: `F${index}`,
            truth: sabotage.explanation || 'A identifier',
            hint: sabotage.hint || 'Vérifiez cette information',
          }
        : null,
    }];
  });

  const fakes = (payload.positions || []).map((pos) => ({
    id: `F${pos.paragraph_index - 1}`,
    tokenId: `p${pos.paragraph_index - 1}`,
    text: pos.false_statement,
    level: 1,
    truth: pos.explanation,
    hint: pos.hint,
  }));

  return {
    title: payload.topic,
    subtitle: 'Wikipedia',
    infobox: [
      { label: 'DESIGNATION', value: payload.topic },
      { label: 'SOURCE', value: payload.wikipedia_url || 'Wikipedia' },
      { label: 'FAKES INJECTED', value: String(payload.total_fakes) },
      { label: 'STATUS', value: 'LIVE', live: true },
    ],
    body: [{ kind: 'lead', paragraphs }],
    fakes,
  };
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
