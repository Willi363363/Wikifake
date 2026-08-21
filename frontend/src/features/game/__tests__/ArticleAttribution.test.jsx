import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LICENSE } from '../../../config.js';
import { ArticleAttribution } from '../ArticleAttribution.jsx';
import { buildArticle } from '../../../lib/article.js';

const SOURCE = 'https://fr.wikipedia.org/wiki/Tour_Eiffel';

describe('ArticleAttribution', () => {
  it('avertit que le texte a été modifié', () => {
    // Obligation CC BY-SA, et garde-fou contre la désinformation
    // involontaire : le joueur doit savoir que ce texte n'est pas fiable.
    render(<ArticleAttribution topic="Tour Eiffel" sourceUrl={SOURCE} />);
    expect(screen.getByText(/volontairement modifié/i)).toBeInTheDocument();
    expect(screen.getByText(/n’est pas une source fiable/i)).toBeInTheDocument();
  });

  it('cite Wikipédia, ses contributeurs et la licence', () => {
    render(<ArticleAttribution topic="Tour Eiffel" sourceUrl={SOURCE} />);
    expect(screen.getByText(/contributeurs/i)).toBeInTheDocument();
    const license = screen.getByRole('link', { name: LICENSE.name });
    expect(license).toHaveAttribute('href', LICENSE.url);
  });

  it('lie l’article source', () => {
    render(<ArticleAttribution topic="Tour Eiffel" sourceUrl={SOURCE} />);
    expect(screen.getByRole('link', { name: /Tour Eiffel/ })).toHaveAttribute('href', SOURCE);
  });

  it('reste complète sans URL source', () => {
    render(<ArticleAttribution topic="Tour Eiffel" sourceUrl="" />);
    expect(screen.getByText(/volontairement modifié/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: LICENSE.name })).toBeInTheDocument();
  });
});

describe('buildArticle', () => {
  it('expose sourceUrl pour l’attribution', () => {
    const article = buildArticle({ topic: 'X', wikipedia_url: SOURCE, total_fakes: 1 });
    expect(article.sourceUrl).toBe(SOURCE);
  });

  it('tolère une source absente', () => {
    expect(buildArticle({ topic: 'X' }).sourceUrl).toBe('');
  });
});
