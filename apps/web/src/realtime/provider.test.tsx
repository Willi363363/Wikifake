/** @vitest-environment jsdom */

// The connection, and the four things it has to get right.
//
// It opens once. It survives a navigation — which is what the whole route-group
// layout exists for, and the pitfall this phase names first. It comes back after
// a network drop with the *same* token, because that is what D5 gives the seat
// back for. And it does not come back after a refusal, because retrying
// `name_taken` forever produces `name_taken` forever.
import { act, cleanup, render, screen } from '@testing-library/react';
import type { OutgoingMessage } from '@wikifake/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RealtimeProvider, useRealtime, useRealtimeMessages } from './provider.js';
import { installFakeSocket, opened } from './testing.js';
import type { FakeSocket } from './testing.js';

let uninstall: () => void;

beforeEach(() => {
  uninstall = installFakeSocket();
  globalThis.sessionStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  uninstall();
});

const LOBBY: OutgoingMessage = { type: 'lobby_update', players: [] };

function Status() {
  const { status, refusal } = useRealtime();
  return (
    <p>
      status:{status} refusal:{refusal ?? '-'}
    </p>
  );
}

function Heard({ onHeard }: { onHeard: (message: OutgoingMessage) => void }) {
  useRealtimeMessages(onHeard);
  return null;
}

const mount = (children = <Status />, room: string | null = 'A1B2C3') =>
  render(
    <RealtimeProvider roomCode={room} playerName="ada">
      {children}
    </RealtimeProvider>,
  );

describe('7.1 — the room connection', () => {
  it('opens nothing until there is a room to be in', () => {
    mount(<Status />, null);
    expect(opened).toHaveLength(0);
    expect(screen.getByText(/status:idle/)).not.toBeNull();
  });

  it('opens one socket for a room', () => {
    mount();
    expect(opened).toHaveLength(1);
    expect(screen.getByText(/status:connecting/)).not.toBeNull();

    act(() => {
      (opened[0] as FakeSocket).accept();
    });
    expect(screen.getByText(/status:open/)).not.toBeNull();
  });

  // Bug 2.1.10 — the server's own schema allows a space, and the current client
  // interpolates the raw nickname into the path.
  it('encodes the nickname it puts in the URL', () => {
    render(
      <RealtimeProvider roomCode="A1B2C3" playerName="Jean Dupont">
        <Status />
      </RealtimeProvider>,
    );
    expect((opened[0] as FakeSocket).url).toContain('/ws/A1B2C3/Jean%20Dupont');
  });

  // D5 — the client owns the token, keeps it for the tab, and sends it on every
  // connection including the first.
  it('carries a session token, and the same one every time', () => {
    mount();
    const first = new URL((opened[0] as FakeSocket).url).searchParams.get('token');
    expect(first).toMatch(/^[A-Za-z0-9_-]{16,128}$/);

    act(() => {
      (opened[0] as FakeSocket).drop(1006);
      vi.advanceTimersByTime(2000);
    });

    expect(opened).toHaveLength(2);
    expect(new URL((opened[1] as FakeSocket).url).searchParams.get('token')).toBe(first);
  });

  describe('what it does with a frame', () => {
    it('hands a message to everyone listening', () => {
      const one = vi.fn();
      const two = vi.fn();
      mount(
        <>
          <Heard onHeard={one} />
          <Heard onHeard={two} />
        </>,
      );

      act(() => {
        (opened[0] as FakeSocket).accept();
        (opened[0] as FakeSocket).deliver(LOBBY);
      });

      expect(one).toHaveBeenCalledWith(LOBBY);
      expect(two).toHaveBeenCalledWith(LOBBY);
    });

    // The mirror of C5.3: the server is not supposed to send rubbish, and if it
    // does, one bad frame must not take the room down.
    it('survives a frame it cannot read', () => {
      const heard = vi.fn();
      mount(<Heard onHeard={heard} />);

      act(() => {
        (opened[0] as FakeSocket).accept();
        (opened[0] as FakeSocket).deliverRaw('not json');
        (opened[0] as FakeSocket).deliverRaw(JSON.stringify({ type: 'from_the_future' }));
        (opened[0] as FakeSocket).deliver(LOBBY);
      });

      expect(heard).toHaveBeenCalledTimes(1);
      expect(heard).toHaveBeenCalledWith(LOBBY);
    });

    it('stops delivering to a listener that has gone', () => {
      const heard = vi.fn();
      const { rerender } = mount(<Heard onHeard={heard} />);

      act(() => {
        (opened[0] as FakeSocket).accept();
      });
      rerender(
        <RealtimeProvider roomCode="A1B2C3" playerName="ada">
          <Status />
        </RealtimeProvider>,
      );

      act(() => {
        (opened[0] as FakeSocket).deliver(LOBBY);
      });
      expect(heard).not.toHaveBeenCalled();
    });
  });

  describe('sending', () => {
    function Sender() {
      const { send } = useRealtime();
      return (
        <button
          type="button"
          onClick={() => {
            send({ type: 'set_ready', ready: true });
          }}
        >
          ready
        </button>
      );
    }

    it('sends once the socket is open', () => {
      mount(<Sender />);
      act(() => {
        (opened[0] as FakeSocket).accept();
      });
      screen.getByRole('button').click();

      expect((opened[0] as FakeSocket).sent).toEqual([
        { type: 'set_ready', ready: true },
      ]);
    });

    // Dropped rather than queued: every message is about the room as it is now,
    // and a `set_ready` delivered after a reconnection is about a room that has
    // moved on.
    it('drops what is sent before it is open', () => {
      mount(<Sender />);
      screen.getByRole('button').click();
      expect((opened[0] as FakeSocket).sent).toEqual([]);
    });
  });

  describe('when the socket goes away', () => {
    it('comes back after a network drop', () => {
      mount();
      act(() => {
        (opened[0] as FakeSocket).accept();
        (opened[0] as FakeSocket).drop(1006);
      });
      expect(screen.getByText(/status:reconnecting/)).not.toBeNull();

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(opened).toHaveLength(2);
    });

    // `name_taken`, `room_not_found`, `invalid_name`: the server sent the reason
    // and closed. Retrying produces the same answer forever.
    it('does not come back after a refusal, and keeps the reason', () => {
      mount();
      act(() => {
        (opened[0] as FakeSocket).drop(1008, 'the nickname ada is already in use');
        vi.advanceTimersByTime(10_000);
      });

      expect(opened).toHaveLength(1);
      expect(screen.getByText(/status:closed/)).not.toBeNull();
      expect(
        screen.getByText(/refusal:the nickname ada is already in use/),
      ).not.toBeNull();
    });
  });

  // The pitfall this phase names first. The provider lives in a layout that
  // survives navigations inside the group, so re-rendering it with the same
  // room must not open a second socket.
  it('does not reopen on a navigation inside the same room', () => {
    const { rerender } = mount(<Status />);
    act(() => {
      (opened[0] as FakeSocket).accept();
    });

    rerender(
      <RealtimeProvider roomCode="A1B2C3" playerName="ada">
        <p>another screen</p>
      </RealtimeProvider>,
    );
    rerender(
      <RealtimeProvider roomCode="A1B2C3" playerName="ada">
        <Status />
      </RealtimeProvider>,
    );

    expect(opened).toHaveLength(1);
    expect((opened[0] as FakeSocket).closedWith).toBeNull();
    expect(screen.getByText(/status:open/)).not.toBeNull();
  });

  it('closes deliberately when it is unmounted', () => {
    const { unmount } = mount();
    act(() => {
      (opened[0] as FakeSocket).accept();
    });

    unmount();
    // 1000, so the server settles a departure rather than waiting on a socket
    // that is not coming back.
    expect((opened[0] as FakeSocket).closedWith).toBe(1000);
  });

  it('refuses to be used outside the provider', () => {
    expect(() => render(<Status />)).toThrow(/RealtimeProvider/);
  });
});
