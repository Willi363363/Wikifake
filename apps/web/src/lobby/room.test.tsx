/** @vitest-environment jsdom */

// The waiting room reads the server, and nothing else.
//
// Every assertion below is driven by delivering a `lobby_update` and looking at
// what the screen says. That is the point of the step: the current list decides
// who the host is with `i === 0`, reads a `color` field the protocol has never
// sent, and cannot show a player whose socket dropped at all.
//
// "Two browsers see each other" is the server's guarantee and is tested where it
// lives — `broadcast.test.ts` in `apps/realtime`, over a real Redis channel.
// What this can prove is the half that failed in the current game: that what the
// server says is what the screen shows.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Room } from './room.js';
import { deliver, mountRoom, player, roster, sent } from './testing.js';
import { RealtimeProvider } from '../realtime/provider.js';
import { installFakeSocket } from '../realtime/testing.js';

let uninstall: () => void;

beforeEach(() => {
  uninstall = installFakeSocket();
  globalThis.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  uninstall();
});

describe('7.3 — the waiting room', () => {
  it('shows the room code', () => {
    mountRoom();
    expect(screen.getByText('A1B2C3')).not.toBeNull();
  });

  it('shows nobody until the server says who is here', () => {
    mountRoom();
    expect(screen.getByText('Players (0)')).not.toBeNull();
  });

  it('shows everyone the server names', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true }), player('bob')));

    expect(screen.getByText('Players (2)')).not.toBeNull();
    expect(screen.getByText('ada')).not.toBeNull();
    expect(screen.getByText('bob')).not.toBeNull();
  });

  // The current list uses `i === 0`. It agrees with the server today, and stops
  // agreeing the first time somebody sorts the roster for display.
  it('marks the host the server names, not the first in the list', () => {
    mountRoom();
    deliver(roster(player('ada'), player('bob', { isHost: true })));

    const hosts = screen.getAllByText('host');
    expect(hosts).toHaveLength(1);
    // The badge sits beside bob, not ada.
    expect(hosts[0]?.closest('li')?.textContent).toContain('bob');
  });

  // D5 — the seat is kept for thirty seconds. A list that cannot say so makes a
  // disconnection look like silence.
  it('shows a dropped player as away rather than losing them', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true }), player('bob', { connected: false })));

    expect(screen.getByText('Players (2)')).not.toBeNull();
    expect(screen.getByText('away')).not.toBeNull();
  });

  it('shows who is ready', () => {
    mountRoom();
    deliver(roster(player('ada', { ready: true }), player('bob')));

    expect(screen.getByText('ready')).not.toBeNull();
    expect(screen.getByText('waiting')).not.toBeNull();
  });

  describe('the ready toggle', () => {
    it('asks the server, and reports what the server answers', async () => {
      const user = userEvent.setup();
      mountRoom();
      deliver(roster(player('ada')));

      await user.click(screen.getByRole('button', { name: "I'm ready" }));
      expect(sent()).toContainEqual({ type: 'set_ready', ready: true });

      // Not flipped locally: the button changes when the roster does.
      expect(screen.getByRole('button', { name: "I'm ready" })).not.toBeNull();
      deliver(roster(player('ada', { ready: true })));
      expect(screen.getByRole('button', { name: 'Ready — cancel' })).not.toBeNull();
    });
  });

  describe('C1.7 — the host decides', () => {
    it('shows the settings to the host', () => {
      mountRoom();
      deliver(roster(player('ada', { isHost: true })));

      expect(screen.getByRole('slider')).not.toBeNull();
      expect(screen.getByRole('switch', { name: /items/i })).not.toBeNull();
    });

    it('hides them from a guest', () => {
      mountRoom('bob');
      deliver(roster(player('ada', { isHost: true }), player('bob')));

      expect(screen.queryByRole('slider')).toBeNull();
      expect(screen.queryByRole('switch')).toBeNull();
      expect(screen.getByText(/Waiting for the host/)).not.toBeNull();
    });

    // The items switch is a `<div onClick>` today: not focusable, no role,
    // nothing on Enter or Space, and nothing announcing whether items are on.
    it('gives the items switch a role and a keyboard', async () => {
      const user = userEvent.setup();
      mountRoom();
      deliver(roster(player('ada', { isHost: true })));

      const items = screen.getByRole('switch', { name: /items/i });
      expect(items.getAttribute('aria-checked')).toBe('true');

      items.focus();
      await user.keyboard('{Enter}');
      expect(items.getAttribute('aria-checked')).toBe('false');
      expect(sent().at(-1)).toMatchObject({ type: 'set_ready', withItems: false });
    });

    it('sends the time limit the host chose', () => {
      mountRoom();
      deliver(roster(player('ada', { isHost: true })));

      fireEvent.change(screen.getByRole('slider'), { target: { value: '120' } });

      expect(sent().at(-1)).toMatchObject({ type: 'set_ready', timeLimit: 120 });
    });

    it('lets the host start, and not a guest', () => {
      mountRoom('bob');
      deliver(roster(player('ada', { isHost: true }), player('bob')));
      expect(screen.queryByRole('button', { name: /Start/ })).toBeNull();

      cleanup();
      mountRoom('ada');
      deliver(roster(player('ada', { isHost: true })));
      expect(screen.getByRole('button', { name: /Start/ })).not.toBeNull();
    });

    // The criterion: promotion on departure is reflected on screen. The server
    // promotes by arithmetic — the host is whoever is first — and the screen
    // finds out the same way everybody does.
    it('follows the host when the server promotes somebody', () => {
      mountRoom('bob');
      deliver(roster(player('ada', { isHost: true }), player('bob')));
      expect(screen.queryByRole('slider')).toBeNull();

      // ada's grace window ran out.
      deliver(roster(player('bob', { isHost: true })));
      expect(screen.getByRole('slider')).not.toBeNull();
      expect(screen.getByRole('button', { name: /Start/ })).not.toBeNull();
    });

    // A refusal must not take the screen down. It is shown, and the roster that
    // arrives next is the truth.
    it('displays a not_host refusal cleanly', () => {
      mountRoom('bob');
      deliver(roster(player('ada', { isHost: true }), player('bob')));

      deliver({
        type: 'error',
        code: 'not_host',
        message: 'only the host can open the vote',
      });

      expect(screen.getByRole('alert').textContent).toContain('only the host');
      // Still a room, still a roster.
      expect(screen.getByText('Players (2)')).not.toBeNull();
    });

    it('drops the refusal when the player tries again', async () => {
      const user = userEvent.setup();
      mountRoom();
      deliver(roster(player('ada')));
      deliver({ type: 'error', code: 'not_host', message: 'only the host' });
      expect(screen.getByRole('alert')).not.toBeNull();

      await user.click(screen.getByRole('button', { name: "I'm ready" }));
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('says so when the connection is not open', () => {
    render(
      <RealtimeProvider roomCode="A1B2C3" playerName="ada">
        <Room roomCode="A1B2C3" nickname="ada" />
      </RealtimeProvider>,
    );
    expect(screen.getByText('connecting')).not.toBeNull();
  });
});
