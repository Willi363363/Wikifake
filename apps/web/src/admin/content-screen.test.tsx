/** @vitest-environment jsdom */

// Which articles are drawn, and what generation costs — step I.7, on screen.
//
// Two claims: **the cache hit rate leads**, because it decides the cost
// section above it, and **the two kinds of failure are kept apart**, because a
// topic nobody can find is not a fault and a falsification that fails is a
// round somebody waited for.
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ContentSection } from './content-screen.js';
import { render, renderIn } from '../i18n/testing.js';
import type { ContentView } from './content.js';

afterEach(() => {
  cleanup();
});

function view(over: Partial<ContentView> = {}): ContentView {
  return {
    games: 200,
    fromCache: 150,
    generated: 50,
    cacheHitRate: 0.75,
    distinctTopics: 62,
    topics: [
      { topic: 'Chat', games: 40, fromCache: 39 },
      { topic: 'Chien', games: 12, fromCache: 2 },
    ],
    failures: {
      falsificationCalls: 60,
      falsificationFailed: 3,
      topicCalls: 80,
      topicFailed: 8,
    },
    falsificationFailureRate: 0.05,
    topicFailureRate: 0.1,
    ...over,
  };
}

describe('I.7 — the figures', () => {
  it('leads with the cache hit rate, and says what it decides', () => {
    render(<ContentSection content={view()} />);

    expect(screen.getByText('75%')).not.toBeNull();
    expect(screen.getByText(/hundred rounds and a hundred generations/)).not.toBeNull();
  });

  it('shows generated against rounds played', () => {
    render(<ContentSection content={view()} />);

    expect(screen.getByText('50')).not.toBeNull();
    expect(screen.getByText('of 200 rounds')).not.toBeNull();
  });

  it('shows the generation failure rate against the calls it is of', () => {
    render(<ContentSection content={view()} />);

    expect(screen.getByText('5%')).not.toBeNull();
    expect(screen.getByText('of 60 calls')).not.toBeNull();
  });

  it('says topic failures apart, and calls them ordinary', () => {
    // Not folded into the headline rate: a word Wikipedia has no article for
    // is not a fault.
    render(<ContentSection content={view()} />);

    expect(screen.getByText(/8 topic choices of 80 came back empty/)).not.toBeNull();
    expect(screen.getByText(/is not a fault/)).not.toBeNull();
  });

  it('says none came back empty rather than showing a bare zero', () => {
    render(
      <ContentSection
        content={view({ failures: { ...view().failures, topicFailed: 0 } })}
      />,
    );

    expect(screen.getByText(/No topic choice came back empty/)).not.toBeNull();
  });

  it('shows an em dash rather than 0% before anything is played', () => {
    render(
      <ContentSection
        content={view({
          games: 0,
          fromCache: 0,
          generated: 0,
          cacheHitRate: null,
          distinctTopics: 0,
          topics: [],
          falsificationFailureRate: null,
          topicFailureRate: null,
        })}
      />,
    );

    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.queryByText('0%')).toBeNull();
    expect(screen.getByText('No rounds played yet.')).not.toBeNull();
  });
});

describe('I.7 — the topic list', () => {
  it('shows each article with its rounds and its cache hits', () => {
    render(<ContentSection content={view()} />);

    const rows = screen.getAllByRole('row').map((row) => row.textContent);
    expect(rows[1]).toContain('Chat');
    expect(rows[1]).toContain('40');
    expect(rows[1]).toContain('39');
    expect(rows[2]).toContain('Chien');
  });

  it('marks an article title as French, which is what it is', () => {
    // The game reads fr.wikipedia.org: the titles are data, and a screen
    // reader saying them in an English voice is what `lang` prevents.
    const { container } = render(<ContentSection content={view()} />);

    expect(container.querySelector('td[lang="fr"]')?.textContent).toBe('Chat');
  });

  it('says how many distinct articles there are, so the list reads as a sample', () => {
    render(<ContentSection content={view()} />);

    expect(screen.getByText('62')).not.toBeNull();
  });

  it('says the same things in French', () => {
    renderIn('fr', <ContentSection content={view()} />);

    expect(screen.getByText('Contenu')).not.toBeNull();
    expect(screen.getByText('Taux de cache')).not.toBeNull();
    expect(screen.getByText(/n'est pas une panne/)).not.toBeNull();
  });
});
