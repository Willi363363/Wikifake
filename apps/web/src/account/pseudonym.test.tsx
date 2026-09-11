/** @vitest-environment jsdom */

// The screen that asks for a pseudonym — step E.3.2.
//
// What a render can see: the one field, the checks that happen before any
// request, the sentence the server sends back, and the fact that there is no
// way past it. What it cannot see is a session or a redirect — `claim.test.ts`
// drives the handler against a real Postgres, and the page's three redirects
// are `page.test.tsx`'s.
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { render } from '../i18n/testing.js';

const push = vi.fn();
const refresh = vi.fn();
const claimed = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock('./client.js', () => ({
  authClient: { signOut: () => Promise.resolve({}) },
  failureOf: (_error: unknown, fallback: string) => fallback,
}));
vi.stubGlobal('fetch', (...args: unknown[]) => claimed(...args));

const { PseudonymScreen } = await import('./pseudonym-screen.js');

beforeEach(() => {
  claimed.mockResolvedValue(
    new Response(JSON.stringify({ pseudonym: 'Ada' }), {
      headers: { 'content-type': 'application/json' },
    }),
  );
});

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

/** Types a name into the one field and submits. */
async function choose(name: string): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Pseudonym'), name);
  await user.click(screen.getByRole('button', { name: 'Take this name' }));
}

describe('E.3.2 — choosing a name', () => {
  it('asks for one thing, and says what it is for', () => {
    render(<PseudonymScreen />);

    expect(screen.getByLabelText('Pseudonym')).toBeDefined();
    expect(screen.getByText(/never appears in a room/)).toBeDefined();
    // Nothing else: the player is already signed in, and a password field here
    // would be asking them to prove something they have just proved.
    expect(screen.queryByLabelText('Email')).toBeNull();
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  it('offers no way past itself, only a way out', () => {
    render(<PseudonymScreen />);

    // Every other account screen carries *play without an account*, because a
    // game playable without signing up is a condition of done. This player has
    // an account: skipping would send them straight back to the gate that
    // redirected them here, so the exit is signing out.
    expect(screen.queryByText('Play without an account')).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
  });

  it('opens filled in with the name a previous attempt failed on', () => {
    // Sign-up sends a refused name here. Arriving at an empty box after typing
    // one is how somebody concludes the first screen lost their account.
    render(<PseudonymScreen attempted="Ada" />);

    expect(screen.getByLabelText<HTMLInputElement>('Pseudonym').value).toBe('Ada');
  });

  it('claims the trimmed name and goes to the game', async () => {
    render(<PseudonymScreen />);

    await choose('  Ada  ');

    expect(claimed).toHaveBeenCalledWith('/api/account/pseudonym', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pseudonym: 'Ada' }),
    });
    expect(push).toHaveBeenCalledWith('/play');
    // The screens that read a pseudonym are server components: without this,
    // the player arrives at the very gate that sent them here.
    expect(refresh).toHaveBeenCalled();
  });

  it('refuses a name the room protocol would refuse, before any request', async () => {
    render(<PseudonymScreen />);

    await choose('ada@lovelace');

    expect((await screen.findByRole('alert')).textContent).toContain('nickname holds');
    expect(claimed).not.toHaveBeenCalled();
  });

  it('shows the server’s own sentence when the name is taken', async () => {
    claimed.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'pseudonym_taken',
          message: 'Another player already goes by that name.',
        }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      ),
    );
    render(<PseudonymScreen />);

    await choose('Ada');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Another player already goes by that name.',
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('falls back to its own sentence when the refusal is silent', async () => {
    claimed.mockResolvedValue(new Response('not json', { status: 409 }));
    render(<PseudonymScreen />);

    await choose('Ada');

    expect((await screen.findByRole('alert')).textContent).toContain(
      'could not be claimed',
    );
  });

  it('does not treat a broken 200 as a name it now holds', async () => {
    // A 200 whose body is not the contract is a broken deployment, not a
    // pseudonym. Navigating away would leave the player at a gate that sends
    // them back here, forever.
    claimed.mockResolvedValue(
      new Response(JSON.stringify({ nothing: true }), {
        headers: { 'content-type': 'application/json' },
      }),
    );
    render(<PseudonymScreen />);

    await choose('Ada');

    expect((await screen.findByRole('alert')).textContent).toContain(
      'could not be claimed',
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('says so when the request never arrives', async () => {
    claimed.mockRejectedValue(new Error('offline'));
    render(<PseudonymScreen />);

    await choose('Ada');

    expect((await screen.findByRole('alert')).textContent).toContain(
      'could not be reached',
    );
  });

  it('lands where it was told to, when it was told', async () => {
    render(<PseudonymScreen next="/room/A1B2C3" />);

    await choose('Ada');

    expect(push).toHaveBeenCalledWith('/room/A1B2C3');
  });
});
