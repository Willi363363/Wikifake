/** @vitest-environment jsdom */

// The probes — step K.10, on the screen.
//
// Amended when the table became a status board. Every claim I.2 made survives
// it — three states told apart by words and not by hue, a commit shortened the
// way git does, the time a failure took — and one moved: the model and its key
// are a figure on the build strip now rather than a line of prose.
//
// The original header follows, because it is still what the page is for.
//
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
    // The time it took to fail is the difference between refused and timed out.
    expect(screen.getByText('answered in 2,000 ms')).not.toBeNull();
    expect(screen.getByText(/answered 503/)).not.toBeNull();
  });

  it('shortens a commit to seven characters, as every git log does', () => {
    render(<HealthSection health={view()} />);

    expect(screen.getAllByText('1.2.3 · aaaaaaa')).toHaveLength(2);
    // And the one that is this process, which answered by rendering the page.
    expect(screen.getByText('answering — this page')).not.toBeNull();
  });

  it('shows the detail alone when there is no commit', () => {
    render(<HealthSection health={view()} />);

    expect(screen.getByText('answering')).not.toBeNull();
  });

  it('says which model, and whether its key is configured', () => {
    render(<HealthSection health={view()} />);

    const build = screen.getByRole('region', { name: 'This build' }).textContent ?? '';
    expect(build).toContain('a-model');
    expect(build).toContain('key configured');
    expect(build).toContain('1.2.3');
    expect(build).toContain('aaaaaaa');
  });

  it('says so when the key is missing', () => {
    // "Key configured" says a variable exists, not that the key works — only
    // playing a round says that — so the absent case has to be as plain as the
    // present one rather than an empty space.
    render(
      <HealthSection
        health={view({ identity: { ...IDENTITY, llmConfigured: false } })}
      />,
    );

    expect(screen.getByRole('region', { name: 'This build' }).textContent).toContain(
      'no key configured',
    );
  });

  it('gives every service a region of its own, named', () => {
    // The board is three cards, and a screen reader gets the same split a
    // sighted reader gets from the gap between them.
    render(<HealthSection health={view()} />);

    const named = screen
      .getAllByRole('region')
      .map((region) => region.getAttribute('aria-label'));
    expect(named).toEqual(['Web app', 'Realtime service', 'Database', 'This build']);
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
