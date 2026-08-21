import { describe, expect, it } from 'vitest';

import {
  articleUrl,
  buildArticle,
  fakeIdFor,
  hintTargets,
  paragraphIndexOf,
  paragraphTexts,
  tokenIdFor,
  withSolution,
} from '../article.js';

const PAYLOAD = {
  topic: 'Tour Eiffel',
  wikipedia_url: 'https://fr.wikipedia.org/wiki/Tour_Eiffel',
  total_fakes: 2,
  paragraphs: [
    'Premier paragraphe, assez long pour être retenu par le rapport de signalement.',
    'Deuxième paragraphe, également assez long pour compter comme du contenu.',
    'Troisième paragraphe, lui aussi suffisamment long pour être listé.',
  ],
};

const SOLUTION = [
  { paragraph_index: 2, false_statement: 'achevée en 1889', explanation: 'En réalité 1887.', hint: 'La date.' },
  { paragraph_index: 3, false_statement: '330 mètres', explanation: 'En réalité 324 m.', hint: 'La hauteur.' },
];

describe('conversions index / identifiant', () => {
  it('fait un aller-retour', () => {
    expect(tokenIdFor(1)).toBe('p0');
    expect(paragraphIndexOf('p0')).toBe(1);
    expect(paragraphIndexOf(tokenIdFor(7))).toBe(7);
    expect(fakeIdFor(4)).toBe('F3');
  });
});

describe('buildArticle', () => {
  it('ne marque aucun paragraphe comme falsifié', () => {
    const article = buildArticle(PAYLOAD);
    const segments = article.body[0].paragraphs.flat();
    expect(segments).toHaveLength(3);
    expect(segments.every((segment) => segment.fake === null)).toBe(true);
    expect(article.fakes).toEqual([]);
  });

  it('conserve le nombre de falsifications annoncé', () => {
    expect(buildArticle(PAYLOAD).totalFakes).toBe(2);
  });

  it('tolère un payload minimal', () => {
    const article = buildArticle({ topic: 'X' });
    expect(article.totalFakes).toBe(0);
    expect(article.body[0].paragraphs).toEqual([]);
  });

  it('expose la source dans l’infobox', () => {
    expect(articleUrl(buildArticle(PAYLOAD))).toBe(PAYLOAD.wikipedia_url);
  });
});

describe('withSolution', () => {
  it('marque exactement les paragraphes de la correction', () => {
    const revealed = withSolution(buildArticle(PAYLOAD), SOLUTION);
    const segments = revealed.body[0].paragraphs.flat();

    expect(segments[0].fake).toBeNull();
    expect(segments[1].fake.id).toBe('F1');
    expect(segments[2].fake.id).toBe('F2');
  });

  it('reporte explication et indice', () => {
    const revealed = withSolution(buildArticle(PAYLOAD), SOLUTION);
    expect(revealed.body[0].paragraphs[1][0].fake.truth).toBe('En réalité 1887.');
    expect(revealed.fakes[0].tokenId).toBe('p1');
  });

  it('ne modifie pas l’article d’origine', () => {
    const article = buildArticle(PAYLOAD);
    withSolution(article, SOLUTION);
    expect(article.body[0].paragraphs[1][0].fake).toBeNull();
    expect(article.fakes).toEqual([]);
  });

  it('sans correction, retourne l’article inchangé', () => {
    const article = buildArticle(PAYLOAD);
    expect(withSolution(article, [])).toBe(article);
    expect(withSolution(article, null)).toBe(article);
  });
});

describe('hintTargets', () => {
  it('produit des cibles numérotées et vides', () => {
    const targets = hintTargets(3);
    expect(targets.map((target) => target.number)).toEqual([1, 2, 3]);
    // Aucune information sur l'emplacement : c'est tout l'objet du changement.
    expect(targets.every((target) => target.hint === '' && target.truth === '')).toBe(true);
  });

  it('vaut une liste vide sans falsification', () => {
    expect(hintTargets(0)).toEqual([]);
  });
});

describe('paragraphTexts', () => {
  it('aplatit le corps et écarte les fragments trop courts', () => {
    const texts = paragraphTexts(buildArticle({ ...PAYLOAD, paragraphs: [...PAYLOAD.paragraphs, 'court'] }));
    expect(texts).toHaveLength(3);
  });
});
