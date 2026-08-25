/** @vitest-environment jsdom */

// The entry screen, driven the way a player drives it.
//
// The criterion has three parts and each is a defect in the current one: the
// three entries lead to the right screen, an invalid nickname is refused
// **before any network call**, and a nickname with a space connects. The middle
// one is the interesting test — today the client checks `!username`, so a
// 200-character name full of emoji passes, the socket opens, the server refuses
// it, and the player is shown a closed connection rather than a reason.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LobbyEntry } from './entry.js';
import { readNickname } from '../realtime/room-gate.js';

const pushed: string[] = [];

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: (path: string) => {
      pushed.push(path);
    },
  }),
}));

let fetched: number;

beforeEach(() => {
  pushed.length = 0;
  fetched = 0;
  globalThis.sessionStorage.clear();
  vi.stubGlobal('fetch', (...args: unknown[]) => {
    fetched += 1;
    void args;
    return Promise.resolve(
      new Response(JSON.stringify({ roomCode: 'A1B2C3' }), { status: 200 }),
    );
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const tab = async (name: string) => {
  const user = userEvent.setup();
  render(<LobbyEntry />);
  await user.click(screen.getByRole('tab', { name }));
  return user;
};

describe('7.2 — the entry screen', () => {
  it('offers the three ways in, as a tablist', () => {
    render(<LobbyEntry />);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: 'Solo' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  describe('solo', () => {
    it('leads to the round, carrying the topic', async () => {
      const user = userEvent.setup();
      render(<LobbyEntry />);

      await user.type(screen.getByLabelText('Wikipedia topic'), 'Chat');
      await user.click(screen.getByRole('button', { name: 'Play solo' }));

      expect(pushed).toEqual(['/solo?topic=Chat']);
    });

    it('encodes a topic that needs it', async () => {
      const user = userEvent.setup();
      render(<LobbyEntry />);

      await user.type(screen.getByLabelText('Wikipedia topic'), 'Côte d’Azur');
      await user.click(screen.getByRole('button', { name: 'Play solo' }));

      expect(pushed[0]).toBe('/solo?topic=C%C3%B4te%20d%E2%80%99Azur');
    });

    it('refuses an empty topic without leaving the screen', async () => {
      const user = userEvent.setup();
      render(<LobbyEntry />);

      await user.click(screen.getByRole('button', { name: 'Play solo' }));
      expect(pushed).toEqual([]);
      expect(screen.getByRole('alert')).not.toBeNull();
    });
  });

  describe('host', () => {
    it('opens a room and goes to it', async () => {
      const user = await tab('Host');

      await user.type(screen.getByLabelText('Nickname'), 'ada');
      await user.click(screen.getByRole('button', { name: 'Open a room' }));

      await waitFor(() => {
        expect(pushed).toEqual(['/room/A1B2C3']);
      });
      expect(readNickname()).toBe('ada');
    });

    // The criterion: refused *before any network call*.
    it.each([
      ['', 'an empty nickname'],
      ['ada 🙂', 'a nickname with an emoji'],
      ['ada!', 'a nickname with punctuation the server refuses'],
      ['   ', 'a nickname that is only spaces'],
    ])('refuses %s and calls nothing', async (name) => {
      const user = await tab('Host');

      if (name !== '') await user.type(screen.getByLabelText('Nickname'), name);
      await user.click(screen.getByRole('button', { name: 'Open a room' }));

      expect(fetched).toBe(0);
      expect(pushed).toEqual([]);
      expect(screen.getByRole('alert')).not.toBeNull();
    });

    // Length is capped by the field rather than refused after the fact: a
    // player who pastes a paragraph gets the first 24 characters, not an error
    // about something they cannot see the end of.
    it('caps the nickname at what the server accepts', async () => {
      const user = await tab('Host');
      const field = screen.getByLabelText('Nickname');

      await user.type(field, 'a'.repeat(30));
      expect((field as HTMLInputElement).value).toHaveLength(24);

      await user.click(screen.getByRole('button', { name: 'Open a room' }));
      await waitFor(() => {
        expect(pushed).toEqual(['/room/A1B2C3']);
      });
    });

    // The criterion: a nickname with a space connects. 7.1 encodes it in the
    // URL; this is the half that stops the client rejecting it first.
    it('accepts a nickname with a space, and an accent', async () => {
      const user = await tab('Host');

      await user.type(screen.getByLabelText('Nickname'), 'Jean Dupont');
      await user.click(screen.getByRole('button', { name: 'Open a room' }));

      await waitFor(() => {
        expect(readNickname()).toBe('Jean Dupont');
      });
      expect(pushed).toEqual(['/room/A1B2C3']);
    });

    it('shows what the server said when it refuses', async () => {
      vi.stubGlobal('fetch', () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              code: 'room_capacity_reached',
              message: 'Too many rooms are open. Try again later.',
            }),
            { status: 503 },
          ),
        ),
      );
      const user = await tab('Host');

      await user.type(screen.getByLabelText('Nickname'), 'ada');
      await user.click(screen.getByRole('button', { name: 'Open a room' }));

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain('Too many rooms');
      });
      expect(pushed).toEqual([]);
    });

    it('says so when the server cannot be reached at all', async () => {
      vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
      const user = await tab('Host');

      await user.type(screen.getByLabelText('Nickname'), 'ada');
      await user.click(screen.getByRole('button', { name: 'Open a room' }));

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain('could not be reached');
      });
    });
  });

  describe('join', () => {
    it('goes to the room, and remembers the nickname on the way', async () => {
      const user = await tab('Join');

      await user.type(screen.getByLabelText('Room code'), 'A1B2C3');
      await user.type(screen.getByLabelText('Nickname'), 'bob');
      await user.click(screen.getByRole('button', { name: 'Join' }));

      expect(pushed).toEqual(['/room/A1B2C3']);
      expect(readNickname()).toBe('bob');
    });

    // A code typed in lower case is a room, not a 404. The server's codes are
    // upper-case by construction.
    it('upper-cases the code as it is typed', async () => {
      const user = await tab('Join');

      await user.type(screen.getByLabelText('Room code'), 'a1b2c3');
      expect(screen.getByLabelText('Room code')).toHaveProperty('value', 'A1B2C3');

      await user.type(screen.getByLabelText('Nickname'), 'bob');
      await user.click(screen.getByRole('button', { name: 'Join' }));
      expect(pushed).toEqual(['/room/A1B2C3']);
    });

    it('will not take a seventh character', async () => {
      const user = await tab('Join');
      const field = screen.getByLabelText('Room code');

      await user.type(field, 'A1B2C3D');
      expect((field as HTMLInputElement).value).toBe('A1B2C3');
    });

    it.each(['', 'A1B2', 'A1B2C!'])('refuses the code %s', async (code) => {
      const user = await tab('Join');

      if (code !== '') await user.type(screen.getByLabelText('Room code'), code);
      await user.type(screen.getByLabelText('Nickname'), 'bob');
      await user.click(screen.getByRole('button', { name: 'Join' }));

      expect(pushed).toEqual([]);
      expect(screen.getByRole('alert')).not.toBeNull();
    });

    // The room is checked first, so a player who mistyped both is told about the
    // code rather than about their name.
    it('does not remember a nickname when the code is wrong', async () => {
      const user = await tab('Join');

      await user.type(screen.getByLabelText('Room code'), 'A1B2');
      await user.type(screen.getByLabelText('Nickname'), 'bob');
      await user.click(screen.getByRole('button', { name: 'Join' }));

      expect(readNickname()).toBeNull();
    });
  });

  it('announces its refusals rather than only showing them', async () => {
    const user = await tab('Host');
    await user.click(screen.getByRole('button', { name: 'Open a room' }));
    expect(screen.getByRole('alert')).not.toBeNull();
  });
});
