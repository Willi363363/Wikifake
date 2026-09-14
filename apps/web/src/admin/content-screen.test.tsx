/** @vitest-environment jsdom */

// Which articles are drawn, and what generation costs — step K.8, on screen.
//
// Amended when the section became the digest. Both of I.7's claims survive it,
// and so does the promise the article titles carry — `lang="fr"`, because the
// game reads fr.wikipedia.org and a screen reader saying *Chat* in an English
// voice is saying a different word.
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

describe('K.8 — the figures', () => {
  it('leads with the cache hit rate, and says what it decides', () => {
    render(<ContentSection content={view()} />);

    expect(screen.getByText('75%')).not.toBeNull();
    expect(screen.getByText(/hundred rounds and a hundred generations/)).not.toBeNull();
    expect(screen.getByText('150 of 200 rounds')).not.toBeNull();
  });

  it('shows generated as the denominator the cost page divides by', () => {
    render(<ContentSection content={view()} />);

    expect(screen.getByText('50')).not.toBeNull();
    expect(screen.getByText('rounds the model wrote')).not.toBeNull();
  });

  it('shows the generation failure rate against the calls it is of', () => {
    render(<ContentSection content={view()} />);

    // Twice on purpose: once as a headline figure, once in the card that keeps
    // it apart from the topic failures it must not be folded into.
    expect(screen.getAllByText('5%')).toHaveLength(2);
    expect(screen.getAllByText('3 of 60 calls')).toHaveLength(2);
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

    // Four: the cache rate, and the falsification rate in both the places it
    // appears, and the topic rate beside it.
    expect(screen.getAllByText('—')).toHaveLength(4);
    expect(screen.queryByText('0%')).toBeNull();
    expect(screen.getAllByText('No rounds played yet.').length).toBeGreaterThan(0);
  });
});

describe('K.8 — the topic list', () => {
  it('shows each article with its rounds and its cache hits', () => {
    render(<ContentSection content={view()} />);

    const rows = screen.getAllByRole('row').map((row) => row.textContent);
    expect(rows[1]).toContain('Chat');
    expect(rows[1]).toContain('40');
    // The share and not the count: a topic played forty times with thirty-nine
    // cache hits and one played twice with two are the same cache, and only
    // the ratio says so.
    expect(rows[1]).toContain('97.5%');
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

    // The page's own name is the chassis heading now (`page-heading.tsx`), so
    // what this asserts is the body.
    expect(screen.getByText('Taux de cache')).not.toBeNull();
    expect(screen.getByText('Quand la génération a échoué')).not.toBeNull();
    expect(screen.getByText(/n’est pas une panne/)).not.toBeNull();
  });
});
