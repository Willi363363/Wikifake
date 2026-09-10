/** @vitest-environment jsdom */

// Step E.6 — who is invited to keep a round, and who is not.
//
// Four session states reach this component and only one of them shows anything,
// so all four have a case. Three of them are the ones that would be wrong to get
// wrong: an account told its round is about to be lost, a failed session request
// read as "this player has no account", and a block that appears a moment late
// and moves the onward button out from under a cursor.
//
// What a signing-up guest actually *keeps* is not here — that is
// `../auth/guests.test.ts` at the handler and `apps/e2e/specs/guest-round.spec.ts`
// in a browser. This file is only about which of the four states is offered the
// invitation.
import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { render } from '../i18n/testing.js';
import { KeepRound } from './keep-round.js';

/** What `useSession` will answer, set by each case before it renders. */
const session = vi.hoisted(() => ({
  value: { data: null as unknown, isPending: false },
}));

vi.mock('./client.js', () => ({
  authClient: { useSession: () => session.value },
  failureOf: (_: unknown, fallback: string) => fallback,
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  session.value = { data: null, isPending: false };
});

/** The invitation, or null when it is not being offered. */
function invitation(): HTMLElement | null {
  return screen.queryByRole('region', { name: 'Keep this round' });
}

describe('E.6 — the invitation', () => {
  it('offers a guest a way to keep the round', () => {
    session.value = {
      data: { user: { id: 'guest-1', isAnonymous: true } },
      isPending: false,
    };

    render(<KeepRound />);

    expect(invitation()).not.toBeNull();
    // The link, and where it goes. Sign-up rather than sign-in because a guest
    // is more likely to have no account than to have forgotten one — and the
    // sign-up screen carries the way across to the other, so the player with an
    // account is one click from it.
    expect(screen.getByRole('link', { name: 'Keep my rounds' })).toHaveProperty(
      'pathname',
      '/sign-up',
    );
  });

  it('says nothing to an account, which has already kept it', () => {
    session.value = {
      data: { user: { id: 'ada', isAnonymous: false } },
      isPending: false,
    };

    render(<KeepRound />);

    expect(invitation()).toBeNull();
  });

  /*
   * The field absent rather than false.
   *
   * `isAnonymous` is a column the anonymous plugin adds, and Better Auth omits
   * an unset optional field rather than sending `false`. A check written as
   * `!isAnonymous` would be correct here and a check written as
   * `isAnonymous === undefined ? true : …` would invite every signed-in player
   * to keep a round they already own, so the comparison is against `true` and
   * this case is what holds it that way.
   */
  it('says nothing to an account whose session omits the field', () => {
    session.value = { data: { user: { id: 'ada' } }, isPending: false };

    render(<KeepRound />);

    expect(invitation()).toBeNull();
  });

  it('says nothing while the session is still being asked for', () => {
    session.value = { data: null, isPending: true };

    render(<KeepRound />);

    expect(invitation()).toBeNull();
  });

  /*
   * No session at all, which on the debrief means the request failed.
   *
   * Every player who reaches a debrief has an identity: `identify()` mints a
   * guest on `POST /api/game/start`, and the ticket route does the same for a
   * room. So a null session here is a fetch that did not arrive, and treating
   * that as "no account" would show the invitation to a signed-in player on a
   * bad connection — telling them a round they own is about to be lost.
   */
  it('says nothing when there is no session to read', () => {
    session.value = { data: null, isPending: false };

    render(<KeepRound />);

    expect(invitation()).toBeNull();
  });
});
