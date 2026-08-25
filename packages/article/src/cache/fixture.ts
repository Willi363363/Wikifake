// One cached round, for the cache tests.
//
// Deliberately not a builder with twenty options: the cache does not read the
// payload, it stores and returns it, so what the tests need is one valid entry
// they can vary by topic and assert on by identity.
import type { CachedArticle } from './cache.js';

export function cachedArticle(variant: string): CachedArticle {
  return {
    article: {
      topic: 'Chocolat',
      paragraphs: [
        `Le chocolat est un aliment — variante ${variant}.`,
        'Deuxième paragraphe.',
      ],
      totalFakes: 1,
      wikipediaUrl: 'https://fr.wikipedia.org/wiki/Chocolat',
    },
    solution: [
      {
        paragraphIndex: 1,
        falseInfoNumber: 1,
        falseStatement: `Le chocolat est un aliment — variante ${variant}.`,
        originalText: 'Le chocolat est un aliment issu de la fève de cacao.',
        explanation: `La vérité de la variante ${variant}.`,
        hint: 'Vérifiez cette date.',
      },
    ],
    html: `<p>variante ${variant}</p>`,
  };
}
