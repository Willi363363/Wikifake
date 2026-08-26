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

beforeEach(() => {
  uninstall = installFakeSocket();
  globalThis.sessionStorage.clear();
  route = {};
});
afterEach(() => {
  cleanup();
  uninstall();
});

describe('9.5 — the gate, after a navigation', () => {
  it('is idle before there is a room', () => {
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
  it('reads the nickname the entry screen wrote on its way out', () => {
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

    expect(screen.getByText('connecting/ada')).not.toBeNull();
    expect(opened).toHaveLength(1);
  });

  it('opens the socket for the room the URL names', () => {
    rememberNickname('ada');
    route = { code: 'A1B2C3' };
    render(
      <RoomGate>
        <Probe />
      </RoomGate>,
    );

    expect(opened[0]?.url).toContain('/ws/A1B2C3/ada');
  });

  it('follows the player from one room to another', () => {
    rememberNickname('ada');
    route = { code: 'A1B2C3' };
    const view = render(
      <RoomGate>
        <Probe />
      </RoomGate>,
    );

    route = { code: 'Z9Y8X7' };
    view.rerender(
      <RoomGate>
        <Probe />
      </RoomGate>,
    );

    expect(opened.at(-1)?.url).toContain('/ws/Z9Y8X7/ada');
  });
});
