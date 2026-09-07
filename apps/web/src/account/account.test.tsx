/** @vitest-environment jsdom */

// The two account screens — step E.2.
//
// What a render can see: the fields, the copy, the way out, the providers, and
// the checks that happen before any request. What it cannot see is a session,
// a cookie or a redirect, and those are `apps/e2e/specs/account.spec.ts`'s —
// against a real Postgres, because an account that is not written down is not
// an account.
//
// `authClient` is mocked rather than a server being stood up. The calls it
// stands in for are Better Auth's own contract, verified in
// `auth/guests.test.ts` by driving `auth.handler` for real; what is asserted
// here is that this screen calls them with what the player typed, and shows
// what comes back.
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { render } from '../i18n/testing.js';
import type * as Client from './client.js';

const signUpEmail = vi.fn();
const signInEmail = vi.fn();
const signInSocial = vi.fn();
const push = vi.fn();

vi.mock('./client.js', async () => {
  const actual = await vi.importActual<typeof Client>('./client.js');
  return {
    // `failureOf` is the real one: it is this module's own logic and mocking it
    // would leave the thing under test untested.
    failureOf: actual.failureOf,
    authClient: {
      signUp: { email: (...args: unknown[]) => signUpEmail(...args) },
      signIn: {
        email: (...args: unknown[]) => signInEmail(...args),
        social: (...args: unknown[]) => signInSocial(...args),
      },
    },
  };
});

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const { AccountScreen } = await import('./account-screen.js');

beforeEach(() => {
  signUpEmail.mockResolvedValue({ data: {}, error: null });
  signInEmail.mockResolvedValue({ data: {}, error: null });
  signInSocial.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

function show(mode: 'signIn' | 'signUp', providers: ('google' | 'github')[] = []) {
  return render(<AccountScreen mode={mode} providers={providers} />);
}

describe('E.2 — signing in', () => {
  it('asks for an email and a password, and nothing else', () => {
    show('signIn');

    expect(screen.getByLabelText('Email')).toBeDefined();
    expect(screen.getByLabelText('Password')).toBeDefined();
    // The pseudonym belongs to creating an account, not to returning to one.
    expect(screen.queryByLabelText('Pseudonym')).toBeNull();
  });

  it('signs in with what was typed, and goes to the game', async () => {
    const user = userEvent.setup();
    show('signIn');

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'a-real-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(signInEmail).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'a-real-password',
    });
    expect(push).toHaveBeenCalledWith('/play');
  });

  it('shows the server’s own sentence when it refuses', async () => {
    // "Invalid email or password" is Better Auth's, and it is better than
    // anything this screen could invent — it knows which of the two it was and
    // deliberately does not say.
    signInEmail.mockResolvedValue({ error: { message: 'Invalid email or password' } });
    const user = userEvent.setup();
    show('signIn');

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'a-real-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Invalid email or password',
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('falls back to its own sentence when the refusal is silent', async () => {
    signInEmail.mockResolvedValue({ error: {} });
    const user = userEvent.setup();
    show('signIn');

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'a-real-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'do not match an account',
    );
  });

  it('says so when the request never arrives', async () => {
    // A refusal and an unreachable server are different things, and a screen
    // that says "wrong password" to somebody on a train is lying to them.
    signInEmail.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    show('signIn');

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'a-real-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'could not be reached',
    );
  });
});

describe('E.2 — creating an account', () => {
  it('asks for the pseudonym, and says what it is for', () => {
    show('signUp');

    expect(screen.getByLabelText('Pseudonym')).toBeDefined();
    // The one privacy promise this track makes, made where it is relevant
    // rather than in a policy nobody opens.
    expect(screen.getByText(/never appears in a room/)).toBeDefined();
  });

  it('sends the trimmed pseudonym as the account name', async () => {
    const user = userEvent.setup();
    show('signUp');

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Pseudonym'), '  Ada  ');
    await user.type(screen.getByLabelText('Password'), 'a-real-password');
    await user.click(screen.getByRole('button', { name: 'Create the account' }));

    expect(signUpEmail).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'a-real-password',
      name: 'Ada',
    });
  });

  it('refuses a pseudonym the room protocol would refuse', async () => {
    // One rule, not two: `playerName` is what the socket refuses a nickname
    // with, so an account cannot be created under a name its owner could never
    // play as. The sentence is the protocol's own.
    const user = userEvent.setup();
    show('signUp');

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Pseudonym'), 'ada@lovelace');
    await user.type(screen.getByLabelText('Password'), 'a-real-password');
    await user.click(screen.getByRole('button', { name: 'Create the account' }));

    expect((await screen.findByRole('alert')).textContent).toContain('nickname holds');
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it('refuses a short password before the round trip', async () => {
    const user = userEvent.setup();
    show('signUp');

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Pseudonym'), 'ada');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create the account' }));

    expect((await screen.findByRole('alert')).textContent).toContain('at least 8');
    expect(signUpEmail).not.toHaveBeenCalled();
  });
});

describe('E.2 — the providers this deployment offers', () => {
  it('shows nothing at all when none is configured', () => {
    // The normal state of a developer's machine, and of every run of this
    // suite. A heading over no buttons would be the giveaway, so the heading
    // is inside the guard.
    show('signIn');

    expect(screen.queryByText(/continue with/i)).toBeNull();
  });

  it('shows a button per configured provider', () => {
    show('signIn', ['google', 'github']);

    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDefined();
    // Capitalised as its owner spells it — which is why the names are copy and
    // not a `toUpperCase` of an id.
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeDefined();
  });

  it('starts the flow with a path, not a URL', async () => {
    const user = userEvent.setup();
    show('signIn', ['google']);

    await user.click(screen.getByRole('button', { name: 'Continue with Google' }));

    // A path resolves against the page's own origin. An absolute URL is how a
    // preview deployment bounces a player into production, authenticates them
    // there, and looks like a button that does nothing.
    expect(signInSocial).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: '/play',
    });
  });
});

describe('E.2 — the way past the screen', () => {
  it.each(['signIn', 'signUp'] as const)('%s offers the other one', (mode) => {
    show(mode);

    const other = mode === 'signIn' ? 'Create one' : 'Sign in';
    expect(screen.getByRole('link', { name: other })).toBeDefined();
  });

  it.each(['signIn', 'signUp'] as const)('%s can be walked past entirely', (mode) => {
    // One of this effort's three conditions for "done" is that a first-time
    // visitor can play without an account. A sign-in page with no exit is how
    // that quietly stops being true.
    show(mode);

    expect(
      screen.getByRole('link', { name: 'Play without an account' }).getAttribute('href'),
    ).toBe('/play');
  });
});
