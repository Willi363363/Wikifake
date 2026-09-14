/** @vitest-environment jsdom */

// The switch, as a browser with no JavaScript would receive it — step L.9.
//
// That is the whole point of the shape: three submit buttons in a form that
// posts. What a render can hold is that the form is a form, that the page it
// would return to is already in the markup, and that the chosen one is
// announced rather than only emboldened.
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { render, renderIn } from '../i18n/testing.js';
import { ThemeSwitch } from './theme-switch.js';

vi.mock('next/navigation', () => ({ usePathname: () => '/fr/play' }));

afterEach(() => {
  cleanup();
});

describe('L.9 — the switch', () => {
  it('offers the three, as submit buttons of one form', () => {
    const { container } = render(<ThemeSwitch theme="system" />);

    const form = container.querySelector('form');
    expect(form?.getAttribute('method')).toBe('post');
    expect(form?.getAttribute('action')).toBe('/api/theme');

    for (const name of ['System', 'Light', 'Dark']) {
      const button = screen.getByRole('button', { name });
      expect(button.getAttribute('type')).toBe('submit');
      expect(button.getAttribute('name')).toBe('theme');
    }
  });

  it('carries the page it is on, so the post can send the reader back', () => {
    const { container } = render(<ThemeSwitch theme="system" />);

    const back = container.querySelector('input[name="next"]');
    expect(back?.getAttribute('type')).toBe('hidden');
    expect(back?.getAttribute('value')).toBe('/fr/play');
  });

  /*
   * `aria-current` and not `disabled`.
   *
   * A disabled control is one a keyboard skips, and *which one am I on* is
   * exactly what somebody tabbing through the footer wants to hear. It is also
   * the same answer the language switch beside it gives.
   */
  it('announces the chosen one rather than only emboldening it', () => {
    render(<ThemeSwitch theme="dark" />);

    expect(
      screen.getByRole('button', { name: 'Dark' }).getAttribute('aria-current'),
    ).toBe('true');
    expect(
      screen.getByRole('button', { name: 'Light' }).getAttribute('aria-current'),
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'Dark' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('speaks French under the French catalogue', () => {
    renderIn('fr', <ThemeSwitch theme="light" />);

    expect(screen.getByRole('button', { name: 'Système' })).not.toBeNull();
    expect(
      screen.getByRole('button', { name: 'Clair' }).getAttribute('aria-current'),
    ).toBe('true');
  });
});
