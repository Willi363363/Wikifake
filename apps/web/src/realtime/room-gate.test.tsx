/** @vitest-environment jsdom */

// The gate reads the nickname again when the room appears.
//
// Written after the browser tests of step 9.5 found that it did not, and the
// consequence was not subtle: **opening a room never opened a socket.** The
// provider stays idle on a `playerName` of null, for the whole life of the room,
// so the roster never arrives and nothing the other player does is ever seen.
//
// It survived every unit suite because every one of them passes the nickname in
// as a prop. The gate is the one piece that reads it, and the one piece nothing
// was rendering.
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { rememberNickname, RoomGate } from './room-gate.js';
import { useRealtime } from './provider.js';
import { installFakeSocket, opened } from './testing.js';

/** The route, as the gate reads it. Changed by the test, as a navigation does. */
let route: { code?: string } = {};
vi.mock('next/navigation', () => ({
  useParams: () => route,
}));

/** Says what the provider below it thinks its state is. */
function Probe() {
  const { status, me } = useRealtime();
  return (
    <p>
      {status}/{me ?? 'nobody'}
    </p>
  );
}

let uninstall: () => void;

/**
 * Step E.3b.2 — the gate now asks the server who this player is, too.
 *
 * Stubbed rather than left to fail, because "no ticket" is a real path and a
 * suite that took it by accident would be asserting the wrong one. What a
 * ticket *is* belongs to `@wikifake/tickets`; what belongs here is that the
 * socket waits for the answer and carries it.
 */
function stubTicket(ticket: string | null = 'signed.ticket'): void {
  vi.stubGlobal('fetch', () =>
    Promise.resolve({
      ok: ticket !== null,
      json: () => Promise.resolve({ ticket }),
    } as Response),
  );
}

/**
 * Lets the ticket's promise settle, and React see the result.
 *
 * The connection is one microtask deeper than it was: the gate resolves a
 * nickname *and* a ticket before the provider is given either.
 */
async function resolved(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  uninstall = installFakeSocket();
  globalThis.sessionStorage.clear();
  stubTicket();
  route = {};
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
  uninstall();
});

describe('9.5 — the gate, after a navigation', () => {
  it('is idle before there is a room', async () => {
    render(
      <RoomGate>
        <Probe />
      </RoomGate>,
    );
    expect(screen.getByText('idle/nobody')).not.toBeNull();
    expect(opened).toHaveLength(0);
  });

  // The bug, in one test. The gate lives in the layout of the `(game)` group so
  // that it survives the navigation from the entry screen into a room — which
  // means it mounts *before* the nickname exists. An effect that ran once would
  // never see the one the entry screen writes a moment later.
  it('reads the nickname the entry screen wrote on its way out', async () => {
    const view = render(
      <RoomGate>
        <Probe />
      </RoomGate>,
    );
    expect(screen.getByText('idle/nobody')).not.toBeNull();

    // What `LobbyEntry` does, in this order: remember the name, then navigate.
    act(() => {
      rememberNickname('ada');
    });
    route = { code: 'A1B2C3' };
    view.rerender(
      <RoomGate>
        <Probe />
      </RoomGate>,
    );

    await resolved();
    expect(screen.getByText('connecting/ada')).not.toBeNull();
    expect(opened).toHaveLength(1);
  });

  it('opens the socket for the room the URL names', async () => {
    rememberNickname('ada');
    route = { code: 'A1B2C3' };
    render(
      <RoomGate>
        <Probe />
      </RoomGate>,
    );

    await resolved();
    expect(opened[0]?.url).toContain('/ws/A1B2C3/ada');
    // And the statement of who they are, which is the other half of what this
    // gate now resolves before letting a socket open.
    expect(opened[0]?.url).toContain('auth=signed.ticket');
  });

  it('follows the player from one room to another', async () => {
    rememberNickname('ada');
    route = { code: 'A1B2C3' };
    const view = render(
      <RoomGate>
        <Probe />
      </RoomGate>,
    );

    await resolved();

    route = { code: 'Z9Y8X7' };
    view.rerender(
      <RoomGate>
        <Probe />
      </RoomGate>,
    );
    // Resolved again, and that is the point of keying the effect on the room:
    // a ticket is bound to the room it was minted for, so the second room needs
    // its own. One carried across would verify nowhere.
    await resolved();

    expect(opened.at(-1)?.url).toContain('/ws/Z9Y8X7/ada');
  });
});
