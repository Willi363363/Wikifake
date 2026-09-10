/** @vitest-environment jsdom */

// The health section — step I.2.
//
// It renders readings and decides one thing: which of three sentences the commit
// line says. That decision is the point of the section, so it is what most of
// these cases are about — and **"unknown" and "disagreeing" must not look the
// same**, because a page that showed one for both would be the page that hid a
// half-finished deploy.
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { HealthSection } from './health-screen.js';
import { render, renderIn } from '../i18n/testing.js';
import type { HealthView, Reading } from './health.js';

afterEach(() => {
  cleanup();
});

const IDENTITY = {
  status: 'ok' as const,
  version: '1.2.3',
  commit: 'a'.repeat(40),
  commitShort: 'aaaaaaa',
  model: 'a-model',
  llmConfigured: true,
};

const UP: readonly Reading[] = [
  { name: 'web', up: true, ms: 0, detail: '1.2.3', commit: 'a'.repeat(40) },
  { name: 'realtime', up: true, ms: 42, detail: '1.2.3', commit: 'a'.repeat(40) },
  { name: 'database', up: true, ms: 3, detail: 'answering' },
];

function view(over: Partial<HealthView> = {}): HealthView {
  return { readings: UP, sameCommit: true, identity: IDENTITY, ...over };
}

describe('I.2 — the readings', () => {
  it('names every service, with its state in words', () => {
    render(<HealthSection health={view()} />);

    for (const name of ['Web app', 'Realtime service', 'Database']) {
      expect(screen.getByText(name)).not.toBeNull();
    }
    // Words and not only a wash: three states told apart by hue alone is three
    // states nobody colour-blind can tell apart, and this is the screen
    // somebody reads while something is broken.
    expect(screen.getAllByText('Up')).toHaveLength(3);
  });

  it('says Down, and how long it took to fail', () => {
    render(
      <HealthSection
        health={view({
          readings: [
            UP[0] as Reading,
            { name: 'realtime', up: false, ms: 2000, detail: 'answered 503' },
            UP[2] as Reading,
          ],
          sameCommit: null,
        })}
      />,
    );

    expect(screen.getByText('Down')).not.toBeNull();
    expect(screen.getByText('2,000 ms')).not.toBeNull();
    expect(screen.getByText('answered 503')).not.toBeNull();
  });

  it('shortens a commit to seven characters, as every git log does', () => {
    render(<HealthSection health={view()} />);

    expect(screen.getAllByText('1.2.3 · aaaaaaa')).toHaveLength(2);
  });

  it('shows the detail alone when there is no commit', () => {
    render(<HealthSection health={view()} />);

    expect(screen.getByText('answering')).not.toBeNull();
  });

  it('says which model, and whether its key is configured', () => {
    render(<HealthSection health={view()} />);

    expect(screen.getByText('Model a-model · key configured: yes')).not.toBeNull();
  });

  it('says so when the key is missing', () => {
    render(
      <HealthSection
        health={view({ identity: { ...IDENTITY, llmConfigured: false } })}
      />,
    );

    expect(screen.getByText('Model a-model · key configured: no')).not.toBeNull();
  });
});

describe('I.2 — the line the section exists for', () => {
  it('says they agree', () => {
    render(<HealthSection health={view()} />);

    expect(screen.getByText(/running the same commit/)).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('raises an alert when they disagree', () => {
    // The one state on this page that is news. `role="alert"` so it is
    // announced, not merely coloured.
    render(<HealthSection health={view({ sameCommit: false })} />);

    expect(screen.getByRole('alert').textContent).toContain('different commits');
  });

  it('distinguishes not knowing from disagreeing', () => {
    render(<HealthSection health={view({ sameCommit: null })} />);

    expect(screen.getByText(/Cannot tell/)).not.toBeNull();
    // Not an alert: unknown is not news.
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/different commits/)).toBeNull();
  });

  it('says the same things in French', () => {
    renderIn('fr', <HealthSection health={view({ sameCommit: false })} />);

    expect(screen.getByRole('alert').textContent).toContain('commits différents');
    expect(screen.getByText('Service temps réel')).not.toBeNull();
  });
});
